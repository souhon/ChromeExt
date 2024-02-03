function get_element(query, callback){
    let id = setInterval(() => {
        let e = document.querySelector(query);
        if(e){
            if(callback) callback(e);
            clearInterval(id);
        }
    }, 1000);
}

chrome.runtime.sendMessage('nytimespage');

get_element('[data-testid="onsite-messaging-unit-gateway"]', (e) => e.remove());
get_element('.css-mcm29f', e => {
    e.style.position = 'relative'
    e.style.overflow = 'visible'
});
get_element('.css-gx5sib', e => e.remove());