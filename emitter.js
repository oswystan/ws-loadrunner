/*
 *********************************************************************************
 *                     Copyright (C) 2018 wystan
 *
 *       filename: emitter.js
 *    description:
 *        created: 2018-03-28 11:26:17
 *         author: wystan
 *
 *********************************************************************************
 */

/*
 ****************************************************************
 * event emitter
 ****************************************************************
 */
class Emitter {
    constructor() {
        this._handlers = Object.create(null);
    };

    /**
     * register the event with a handler
     * @param  {string}     event
     * @param  {function}   handler
     * @return {NA}         NA
     */
    on(event, handler) {
        this._handlers[event] = this._handlers[event] || [];
        handler._once = false;
        this._handlers[event].push(handler);
    };

    /**
     * same as on but just run once when the given event fired
     * @param  {string}     event
     * @param  {function}   handler
     * @return {NA}         NA
     */
    once(event, handler) {
        this._handlers[event] = (this._handlers[event] || []);
        handler._once = true;
        this._handlers[event].push(handler);
    };

    /**
     * turn off the event handler
     * @param  {string}     event
     * @param  {function}   handler
     * @return {NA}         NA
     */
    off(event, handler) {
        let handlers = this._handlers[event];
        if (!handlers) return;
        if (handler) {
            handlers.splice(handlers.indexOf(handler)>>>0, 1);
        } else {
            handlers = [];
        }
    };

    /**
     * fire the event with arguments
     * @param  {string}     event
     * @return {NA}         NA
     */
    emit(event, ...args) {
        let emitter = this;
        (this._handlers[event] || []).slice().map(function(handler){
            if(handler._once) {
                emitter.off(event, handler);
            }
            handler(...args);
        });
    };

    /**
     * fire the event with arguments asynchronously
     * @param  {string}     event
     * @return {NA}         NA
     */
    aemit(event, ...args) {
        let emitter = this;
        let promise = new Promise(function (resolve, reject) {
            resolve();
        }).then(function () {
            emitter.emit(event, ...args);
        });
    };

    check(event) {
        return (this._handlers[event] && this._handlers[event].length > 0);
    };
};

module.exports = function() {
    return new Emitter();
};

/************************************* END **************************************/

