function get_element(query, callback){
    let id = setInterval(() => {
        let e = document.querySelector(query);
        if(e){
            if(callback) callback(e);
            clearInterval(id);
        }
    }, 1000);
}

chrome.runtime.sendMessage('wiredpage');
get_element('.PersistentBottomWrapper-eddooY', e => e.remove());