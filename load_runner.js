/*
 *********************************************************************************
 *                     Copyright (C) 2018 wystan
 *
 *       filename: load_runner.js
 *    description:
 *        created: 2018-03-27 15:52:58
 *         author: wystan
 *
 *********************************************************************************
 */

class LoadRunner {
    constructor(argv) {}

    /**
     * event handler
     * @param  {string} msg         event that you want to subscribed:
     *         'error'     - handler(errno)
     *         'finished'  - handler(MainReport);
     *         'connected' - all connections connected
     *         'disconnected' - all connections disconnected
     *         'progress'
     * @param  {function} handler   callback handler
     * @return {NA}                 NA
     */
    on(msg, handler) {}

    run();
};

module.exports = function(argv) {
    return new LoadRunner(argv);
}

/************************************* END **************************************/

