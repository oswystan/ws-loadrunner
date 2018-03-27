/*
 *********************************************************************************
 *                     Copyright (C) 2018 wystan
 *
 *       filename: log.js
 *    description:
 *        created: 2018-03-27 15:57:23
 *         author: wystan
 *
 *********************************************************************************
 */

let ts = function() {
    return new Date().toISOString();
};

const LOG_VERBOSE = 5;
const LOG_DEBUG   = 4;
const LOG_INFO    = 3;
const LOG_WARN    = 2;
const LOG_ERROR   = 1;
const LOG_NO_LOG  = 0;
let LOG_CUR_LEVEL = LOG_VERBOSE;

const logv = (...args) => LOG_CUR_LEVEL >= LOG_VERBOSE && console.log.apply  (null, ['[V|' + ts() + ']', ...args]);
const logd = (...args) => LOG_CUR_LEVEL >= LOG_DEBUG   && console.log.apply  (null, ['[D|' + ts() + ']', ...args]);
const logi = (...args) => LOG_CUR_LEVEL >= LOG_INFO    && console.info.apply (null, ['[I|' + ts() + ']', ...args]);
const logw = (...args) => LOG_CUR_LEVEL >= LOG_WARN    && console.warn.apply (null, ['[W|' + ts() + ']', ...args]);
const loge = (...args) => LOG_CUR_LEVEL >= LOG_ERROR   && console.error.apply(null, ['[E|' + ts() + ']', ...args]);
const log  = (...args) => process.stdout.write(...args);

module.exports.logv = logv;
module.exports.logd = logd;
module.exports.logi = logi;
module.exports.logw = logw;
module.exports.loge = loge;
module.exports.log  = log;

/************************************* END **************************************/

