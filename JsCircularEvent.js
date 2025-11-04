const JsEvent = require("./JsEvent");

class JsCircularEvent extends JsEvent {
    constructor() {
        super();
    }

    call(param) {
        let results = param;
        const keys = Object.keys(this.events);

        if (keys.length !== 0) {
            for (let index = 0, len = keys.length; index < len; ++index) {
                const key = keys[index];

                if (this.events[key]) {
                    const { args, callback } = this.events[key];
                    results.defaultsParams = args;
                    if (callback){
                        results = {...results, ...this.#_call_callback(
                        callback,
                        results
                        ) ?? {}};
                    }
                }
            }
        }

        return results;
    }

  #_call_callback(callback, ...args) {
    return callback(...args);
  }
}

module.exports = JsCircularEvent;