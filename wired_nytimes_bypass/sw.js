class DDebugger {
    constructor(tabId, version='1.3'){
        this.target = {tabId: tabId};
        this.version = version;
        this.scripts = []

        try{
            this.attach();
        }catch(e){
            this.detach();
            this.attach();
        }
    }

    async enableAgent(){
        return await this.sendCommand('Debugger.enable');
    }

    async getScript(scriptId){
        let srcObj = await this.sendCommand('Debugger.getScriptSource', {scriptId: scriptId});
        return new DJavaScript(this, scriptId, srcObj.scriptSource);
    }

    async getDocument(){
        let rootId = (await this.sendCommand('DOM.getDocument')).root.nodeId;
        return await new DDOMElement(this, rootId);
    }

    async attach(){
        return await chrome.debugger.attach(this.target, this.version);
    }

    async detach(){
        return await chrome.debugger.detach(this.target);
    }

    async pause(){
        return await this.sendCommand('Debugger.pause');
    }

    async resume(){
        return await this.sendCommand('Debugger.resume');
    }

    async evaluate(callFrameId, expression){
        return await this.sendCommand('Debugger.evaluateOnCallFrame', {callFrameId: callFrameId, expression: expression});
    }

    async sendCommand(method, params={}){
        console.log(this.target);
        console.log(method);
        console.log(params);
        let ret = await chrome.debugger.sendCommand(this.target, method, params);
        console.log(ret);
        return ret;
    }
}

class DJavaScript {
    constructor(debugger_, scriptId, source){
        this.debugger_ = debugger_;
        this.scriptId = scriptId;
        this.source = source;
    }

    findCode(expr){
        let idx = this.source.indexOf(expr);
        if(idx != -1){
            let spl = this.source.substring(0, idx).split('\n');
            return {line: spl.length - 1, col: spl[spl.length-1].length}
        }
    }

    async setBreakPoint(codePos, condition=''){
        let bpObj = await this.debugger_.sendCommand('Debugger.setBreakpoint', {location: {scriptId: this.scriptId, lineNumber: codePos.line, columnNumber: codePos.col}, condition: condition});
        return new DBreakPoint(this.debugger_, bpObj.breakpointId)
    }
}

class DBreakPoint{
    constructor(debugger_, bpId){
        this.debugger_ = debugger_;
        this.id = bpId;

        chrome.debugger.onEvent.addListener((source, method, params) => {
            if(method === 'Debugger.paused'){
                if(params.hitBreakpoints[0] == this.id && this.onHit) this.onHit(source, params);
            }
        });
    }

    continue(){
        this.debugger_.resume();
    }

    remove(){
        this.debugger_.sendCommand('Debugger.removeBreakpoint', {breakpointId: this.id})
    }
}

class DDOMElement {
    constructor(debugger_, nodeId) {
        this.id = nodeId;
        this.debugger_ = debugger_;
    }

    async querySelector(selector){
        let node = await this.debugger_.sendCommand('DOM.querySelector', {nodeId: this.id, selector: selector});
        return new DDOMElement(this.debugger_, node.nodeId);
    }

    async setBreakPoint(type){
        return await this.debugger_.sendCommand('DOMDebugger.setDOMBreakpoint', {nodeId: this.id, type: type});
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message === 'nytimespage' || message === 'wiredpage'){
        let dbg = new DDebugger(sender.tab.id);
        dbg.enableAgent();
        chrome.debugger.onEvent.addListener((source, method, params) => {
            if(method === 'Debugger.scriptParsed'){
                if(params.embedderName.endsWith('main-b8cd943a3c2de6d69028.js')){
                    (async() => {
                        script = await dbg.getScript(params.scriptId);
                        let bp = await script.setBreakPoint(script.findCode('return e instanceof m&&("string"!=typeof e.nodeName'), "e.data.startsWith('. Cancellation takes')")
                        bp.onHit = async () => {
                            let bp2 = await script.setBreakPoint(script.findCode('var n=e.alternate,r=e.flags;'));
                            bp2.onHit = async (source, params) => {
                                await dbg.evaluate(params.callFrames[0].callFrameId, 
                                    `
                                        as = () => {};
                                        document.querySelectorAll('picture').forEach(e => {
                                            e.style.opacity = 1;
                                        });
                                    `
                                    );
                                await bp2.remove();
                                bp2.continue();
                            };
                            await bp.remove();
                            bp.continue();
                        };
                    })();
                }

                if(params.embedderName.endsWith('build-66a1ecc5eefa69f48189bcc0e310504d.js')){
                    (async() => {
                        script = await dbg.getScript(params.scriptId);
                        let bp = await script.setBreakPoint(script.findCode('o(),new MutationObserver((u=[])=>{'))
                        bp.onHit = async (source, params) => {
                            await dbg.evaluate(params.callFrames[0].callFrameId, 'o = () => {}');
                            bp.continue();
                        };
                    })();
                }
            }
        });
    }
    return true;
});