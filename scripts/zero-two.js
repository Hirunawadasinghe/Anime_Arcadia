function setup_chatbot() {
    const chat_logs = JSON.parse(localStorage.getItem("chatbot_logs")) || [];
    if (chat_logs.length > 0) {
        chat_logs.forEach(log => {
            create_chatbot_message(log.message, log.sender, log.command);
        });
    }

    create_chatbot_message("<p>Hello there 👋</p>", "bot");
    create_chatbot_message("<p>How can I help you today?</p>", "bot");
    create_chatbot_message("<p>Search anime</p>", "system", "/search {anime title/character/genre}");
    create_chatbot_message("<p>Get suggestions</p>", "system", "/suggest");
    create_chatbot_message("<p>Recommend me an anime</p>", "system", "/recommend");
    create_chatbot_message("<p>Find a similar anime</p>", "system", "/similar {anime name}");
    create_chatbot_message("<p>Pick random</p>", "system", "/random");
    create_chatbot_message("<p>Details about an anime</p>", "system", "/details {anime name}");
}

function add_to_chatbot_logs(message, sender, command) {
    let chat_logs = JSON.parse(localStorage.getItem("chatbot_logs")) || [];

    chat_logs.push({
        "message": message,
        "sender": sender,
        "command": command
    });

    if (chat_logs.length > 50) {
        chat_logs = chat_logs.slice(1);
    }

    localStorage.setItem("chatbot_logs", JSON.stringify(chat_logs));
}

function create_chatbot_message(message, sender, command, message_id) {
    const html_output = document.createElement("div");
    if (message_id) {
        html_output.id = message_id;
    }
    html_output.innerHTML = `<div>${message}</div>`;
    html_output.classList.add("chat-message");

    if (sender === "system") {
        html_output.classList.add("chat-button");
        html_output.onclick = function () {
            document.getElementById("bot-input").value = command;
        }
    } else if (sender === "bot") {
        html_output.classList.add("from-bot");
    } else {
        html_output.classList.add("from-user");
    }

    document.getElementById("chat-preview").appendChild(html_output);
    document.getElementById("chat-preview").scrollTop = document.getElementById("chat-preview").scrollHeight;
}


let bot_answer_id = 0;
function send_message_to_bot() {
    const user_message = document.getElementById("bot-input").value.trim();
    if (user_message === '') {
        return
    }
    document.getElementById("bot-input").value = '';
    bot_answer_id++;

    add_to_chatbot_logs(`<p>${user_message}</p>`, "user");
    create_chatbot_message(`<p>${user_message}</p>`, "user");
    create_chatbot_message("<p>...</p>", "bot", "", "bot-answer-" + bot_answer_id);

    data_json_file.then(data => {
        let bot_answer = get_answer_from_bot(user_message, data);
        if (bot_answer.length > 0) {
            setTimeout(function () { set_the_message(bot_answer); }, (0.5 + Math.random() * 0.5) * 1000);
        } else {
            get_answer_from_bot(user_message, data).then(answer => {
                setTimeout(function () { set_the_message(answer); }, Math.random() * 0.5 * 1000);
            })
        }

        function set_the_message(message) {
            document.getElementById("bot-answer-" + bot_answer_id).remove();
            add_to_chatbot_logs(message, "bot");
            create_chatbot_message(message, "bot");
        }
    })
}


let error_answers_roll = -1;
const chatbot_error_answers = ["Oopsie! That’s beyond my anime knowledge 😳", "Eep! I don't understand that at all! 😕", "Noo~! I’m all out of answers 🐾", "Hmm...I’m a little confused 🐱 Can you use a tag to ask that?", "Yikes! My head is spinning! Let’s try a different topic, okay? 🌼", "Nyaa~! I'm not sure how to answer that 🐾"];

function get_answer_from_bot(query, data) {
    let [command_tag, ...text_value] = query.split(" ");
    text_value = text_value.join(" ").trim();

    function get_error_message() {
        error_answers_roll++;
        if (error_answers_roll === chatbot_error_answers.length) {
            error_answers_roll = 0;
        }
        return `<p>${chatbot_error_answers[error_answers_roll]}</p>`;
    }

    if (!command_tag.startsWith("/")) {
        return get_error_message();

    } else {
        if (command_tag === "/search") {
            let search_results = searchDataBase(splitWords(text_value, [" ", "–", ":", ",", "|", "/", "(", ")", "'"]), ["name", "alt_name", "tags", "release_year", "description"], data);
            if (!search_results.length > 0) {
                search_results = do_spelling_search(text_value, data);
            }
            if (search_results.length > 0) {
                search_results.sort((a, b) => b.priorty - a.priorty);
                let returning_value = `<p>Search results for "${text_value}"</p>`;
                for (let i = 0; i < search_results.length && i < 10; i++) {
                    if (search_results[i].language === "Japanese") {
                        returning_value += `<a href="watch?v=${search_results[i].movie_id}">${search_results[i].name}</a>`;
                    } else {
                        returning_value += `<a href="watch?v=${search_results[i].movie_id}">${search_results[i].name} (${search_results[i].language})</a>`;
                    }
                }
                returning_value = returning_value + `<p>For more results, <a href="search?text=${text_value}" target="_blank">click here.</a></p>`
                return returning_value;
            } else {
                return "<p>Sorry, I couldn’t find any results that match your search 😕</p>";
            }

        } else if (command_tag === "/suggest") {
            const watchHistory = get_from_localStorage("watchHistory");
            const suggestions = get_suggestions(watchHistory, data);
            if (!suggestions) {
                return `<p>Looks like your watch history is empty ^..^ Start watching to receive personalized suggestions based on your taste!</p>`;
            } else {
                let returning_value = `<p>Here are some suggestions that match your tastes:</p>`;
                for (let i = 0; i < suggestions.length && i < 10; i++) {
                    returning_value = returning_value + `<a href="watch?v=${suggestions[i].movie_id}" traget="_blank">${suggestions[i].name}</a>`;
                }
                return returning_value;
            }

        } else if (command_tag === "/similar") {
            let search_results = do_spelling_search(text_value, data);
            if (!search_results.length > 0) {
                search_results = searchDataBase(splitWords(text_value, [" ", "–", ":", ",", "|", "/", "(", ")", "'"]), ["name", "alt_name"], data);
                search_results.sort((a, b) => b.priorty - a.priorty);
            }
            if (search_results.length > 0) {
                let elements = get_suggestions([search_results[0]], data);
                elements = elements.filter(e => e !== search_results[0]);
                let returning_value = `<p>Here are some anime similar to "${search_results[0].name}"</p>`;
                for (let i = 0; i < elements.length && i < 10; i++) {
                    returning_value = returning_value + `<a href="watch?v=${elements[i].movie_id}">${elements[i].name}</a>`;
                }
                return returning_value;
            } else {
                return "<p>Sorry, I couldn’t find any results that match your search title 😕</p>";
            }

        } else if (command_tag === "/recommend") {
            const watchHistory = get_from_localStorage("watchHistory");
            let suggestions = get_suggestions(watchHistory, data);
            if (!suggestions) {
                return `<p>Sorry, I couldn't find any anime to recommend at the moment... Start watching to get personalized recommendations based on your taste!</p>`;
            } else {
                if (suggestions.length > 5) {
                    suggestions = suggestions.slice(0, 5);
                }
                return `<p>Here's a recommendation based on your taste:</p>` + add_data_to_HTML_element(suggestions[Math.round(Math.random() * (suggestions.length - 1))], true);
            }

        } else if (command_tag === "/random") {
            return `<p>Here's a random anime!</p>` + add_data_to_HTML_element(data[Math.round(Math.random() * (data.length - 1))], true);

        } else if (command_tag === "/details") {
            let search_results = do_spelling_search(text_value, data);
            if (!search_results.length > 0) {
                search_results = searchDataBase(splitWords(text_value, [" ", "–", ":", ",", "|", "/", "(", ")", "'"]), ["name", "alt_name"], data);
                search_results.sort((a, b) => b.priorty - a.priorty);
            }
            if (search_results.length > 0) {
                const element = search_results[0];
                let new_tags = '';
                element.tags.forEach(tag => {
                    if (new_tags === '') {
                        new_tags = `<a href="search?tags=${tag}" target="_blank">${tag}</a>`;
                    } else {
                        new_tags = new_tags + `, <a href="search?tags=${tag}" target="_blank">${tag}</a>`
                    }
                });

                return fetchData(`https://www.omdbapi.com/?t=${encodeURIComponent(search_results[0].name)}&apikey=217028fd`).then(d => {
                    if (d.Response == "True") {
                        const returning_data = `
                        <p>Here are the details about "${element.name}"</p>
                        <span class="message-image"><img src="${element.thumbnail_image}"></span>
                        ${element.name === element.alt_name ? `<p><b>Title</b>: ${element.name}</p>` : `<p><b>Title</b>: ${element.name} <br> (${element.alt_name})</p>`}
                        <p><b>Type</b>: <a href="search?type=${element.type}" target="_blank">${element.type}</a></p>
                        <p><b>Language</b>: <a href="search?language=${element.language}" target="_blank">${element.language}</a></p>
                        <p><b>Released date</b>: ${element.release_year}</p>
                        <p><b>Country</b>: ${d.Country}</p>
                        <p><b>Director</b>: ${d.Director}</p>
                        <p><b>Writer</b>: ${d.Writer}</p>
                        <p><b>Voice Actors</b>: ${d.Actors}</p>
                        <p><b>Episodes</b>: ${element.episodes}</p>
                        <p><b>Runtime</b>: ${d.Runtime}</p>
                        <p><b>Total Seasons</b>: ${d.totalSeasons}</p>
                        <p><b>IMDB Rating</b>: ${d.imdbRating}</p>
                        <p><b>IMDB Votes</b>: ${d.imdbVotes}</p>
                        <p><b>Genres</b>: ${new_tags}</p>
                        <p><b>Description</b>: ${element.description}</p>
                        <p>Click the link below to start watching 👇</p>
                        <a href="watch?v=${element.movie_id}" traget="_blank">${window.location.origin}/watch?v=${element.movie_id}</a>
                    `;
                        return returning_data;
                    } else {
                        return `<p>Here are the details about "${search_results[0].name}"</p>` + add_data_to_HTML_element(search_results[0], false);
                    }
                })
            } else {
                return "<p>Sorry, I couldn’t find any results that match your search title 😕</p>";
            }

        } else {
            return get_error_message();
        }
    }
}


function add_data_to_HTML_element(element, shorten_the_description) {
    let new_tags = '';
    element.tags.forEach(tag => {
        if (new_tags === '') {
            new_tags = `<a href="search?tags=${tag}" target="_blank">${tag}</a>`;
        } else {
            new_tags = new_tags + `, <a href="search?tags=${tag}" target="_blank">${tag}</a>`
        }
    });

    let new_description = element.description;
    if (shorten_the_description && element.description.length > 300) {
        new_description = element.description.slice(0, 300);
        new_description = new_description.trim() + "...";
    }

    return `
        <span class="message-image"><img src="${element.thumbnail_image}"></span>
        ${element.name === element.alt_name ? `<p><b>Title</b>: ${element.name}</p>` : `<p><b>Title</b>: ${element.name} <br> (${element.alt_name})</p>`}
        <p><b>Language</b>: <a href="search?language=${element.language}" target="_blank">${element.language}</a></p>
        <p><b>Released date</b>: ${element.release_year}</p>
        <p><b>Type</b>: <a href="search?type=${element.type}" target="_blank">${element.type}</a></p>
        <p><b>Episodes</b>: ${element.episodes}</p>
        <p><b>Genres</b>: ${new_tags}</p>
        <p><b>Description</b>: ${new_description}</p>
        <p>Click the link below to start watching 👇</p>
        <a href="watch?v=${element.movie_id}" traget="_blank">${window.location.origin}/watch?v=${element.movie_id}</a>
    `;
}
