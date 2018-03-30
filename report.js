/*
 *********************************************************************************
 *                     Copyright (C) 2018 wystan
 *
 *       filename: report.js
 *    description:
 *        created: 2018-03-27 19:57:13
 *         author: wystan
 *
 *********************************************************************************
 */
const logv   = require("./log").logv;
const logd   = require("./log").logd;
const logi   = require("./log").logi;
const logw   = require("./log").logw;
const loge   = require("./log").loge;
const printf =require('printf');

const ERRNO = {
    SUCC             : 0,
    SERVER_ERR       : 1,
    CONN_ERR         : 2,
    INVAL            : 3,
    MODULE_NOT_FOUND : 4,
    EPERM            : 5,
};

function max_date(a, b) {
    return a > b ? a : b;
}
function min_date(a, b) {
    return a > b ? b : a;
}

class WorkerReport {
    constructor() {
        this.start             = 0;
        this.end               = 0;
        this.total_request     = 0;
        this.total_response_ms = 0;
        this.min_response_ms   = Number.MAX_VALUE;
        this.max_response_ms   = 0;
        this.result            = ERRNO.SUCC;
    }

    jsonify() {
        return {
            start             : this.start             ,
            end               : this.end               ,
            total_request     : this.total_request     ,
            total_response_ms : this.total_response_ms ,
            min_response_ms   : this.min_response_ms   ,
            max_response_ms   : this.max_response_ms   ,
            result            : this.result            ,
        };
    }
};

class MainReport {
    constructor(argv) {
        this.url               = argv ? argv.url : "";
        this.connections       = argv ? argv.amount : 0 ;
        this.cocurrency        = argv ? argv.cocurrency : 0;
        this.tps               = 0;
        this.total_response_ms = 0;
        this.max_response_ms   = 0;
        this.min_response_ms   = Number.MAX_VALUE;
        this.avg_response_ms   = 0;
        this.total_request     = 0;
        this.duration_in_sec   = 0;
        this.start_time        = new Date();
        this.end_time          = new Date();
        this.errors            = 0;
    }

    /**
     * build a new MainReport from a json object
     */
    parse(obj) {
        this.url               = obj.url;
        this.connections       = obj.connections;
        this.cocurrency        = obj.cocurrency;
        this.tps               = obj.tps;
        this.total_response_ms = obj.total_response_ms;
        this.max_response_ms   = obj.max_response_ms;
        this.min_response_ms   = obj.min_response_ms;
        this.avg_response_ms   = obj.avg_response_ms;
        this.total_request     = obj.total_request;
        this.duration_in_sec   = obj.duration_in_sec;
        this.start_time        = new Date(obj.start_time);
        this.end_time          = new Date(obj.end_time);
        this.errors            = obj.errors;
    }

    start() {
        this.start_time = new Date();
    }
    stop() {
        this.end_time = new Date();
        this.duration_in_sec = Math.floor((this.end_time - this.start_time) / 1000);
        this.tps = Math.floor(this.total_request / this.duration_in_sec);
        this.avg_response_ms = Math.floor(this.total_response_ms / this.total_request);
    }
    on_worker_report(report) {
        this.total_request += report.total_request;
        this.total_response_ms += (report.total_response_ms);
        if (this.min_response_ms > report.min_response_ms) {
            this.min_response_ms = report.min_response_ms;
        }
        if (this.max_response_ms < report.max_response_ms) {
            this.max_response_ms = report.max_response_ms;
        }
        if (report.result != ERRNO.SUCC) {
            this.errors++;
        }
    }

    jsonify() {
        return {
            url               : this.url,
            connections       : this.connections,
            cocurrency        : this.cocurrency,
            tps               : this.tps,
            total_response_ms : this.total_response_ms,
            max_response_ms   : this.max_response_ms,
            min_response_ms   : this.min_response_ms,
            avg_response_ms   : this.avg_response_ms,
            total_request     : this.total_request,
            duration_in_sec   : this.duration_in_sec,
            start_time        : this.start_time,
            end_time          : this.end_time,
            errors            : this.errors,
        };
    }

    stringify() {
        let a = "";
        a += printf("%18s : %s\n", "url", this.url);
        a += printf("%18s : %d\n", "connections", this.connections);
        a += printf("%18s : %d\n", "cocurrency", this.cocurrency);
        a += printf("%18s : %d\n", "tps", this.tps);
        a += printf("%18s : %d\n", "avg_response_ms", this.avg_response_ms);
        a += printf("%18s : %d\n", "max_response_ms", this.max_response_ms);
        a += printf("%18s : %d\n", "min_response_ms", this.min_response_ms);
        a += printf("%18s : %d\n", "total_request", this.total_request);
        a += printf("%18s : %d\n", "total_response_ms", this.total_response_ms);
        a += printf("%18s : %d\n", "duration_in_sec", this.duration_in_sec);
        a += printf("%18s : %s\n", "start_time", this.start_time.toISOString());
        a += printf("%18s : %s\n", "end_time", this.end_time.toISOString());
        a += printf("%18s : %d\n", "errors", this.errors);
        return a;
    }
};

class ClusterReport {
    constructor(argv) {
        this.workers         = argv.worker;
        this.workers_succ    = 0;
        this.workers_fail    = 0;
        this.app             = argv.name;
        this.main            = new MainReport();
        this.main.start_time = null;
        this.main.end_time   = null;
    }

    jsonify() {
        return {};
    }

    stringify() {
        let s = "";
        if (this.workers_succ === 0) {
            s += '****************************\n';
            s += '    NO CLUSTER GENERATED    \n';
            s += '****************************\n';
            return s;
        }
        s += printf("%18s : %d\n", "workers", this.workers);
        s += printf("%18s : %d\n", "workers_succ", this.workers_succ);
        s += printf("%18s : %d\n", "workers_fail", this.workers_fail);
        s += printf("%18s : %s\n", "app", this.app);
        s += this.main.stringify();
        return s;
    }

    on_error() {
        this.workers_fail++;
    }

    on_main_report(r) {
        logd("on main report:", this.main.connections, this.main.cocurrency, r.connections, r.cocurrency);
        this.workers_succ++;
        let main =this.main;
        main.url = r.url;
        main.connections += r.connections;
        main.cocurrency += r.cocurrency;
        main.tps += r.tps;
        if (main.avg_response_ms === 0) {
            main.avg_response_ms = r.avg_response_ms;
        } else {
            main.avg_response_ms = (main.avg_response_ms + r.avg_response_ms) / 2;
        }
        main.duration_in_sec = Math.max(main.duration_in_sec, r.duration_in_sec);
        main.total_request += r.total_request;
        main.total_response_ms += r.total_response_ms;

        main.min_response_ms = Math.min(main.min_response_ms, r.min_response_ms);
        main.max_response_ms = Math.max(main.max_response_ms, r.max_response_ms);
        main.errors += r.errors;

        if (main.start_time) {
             main.start_time = min_date(main.start_time, r.start_time);
        } else {
            main.start_time = r.start_time;
        }

        if (main.end_time) {
             main.end_time = max_date(main.end_time, r.end_time);
        } else {
            main.end_time = r.end_time;
        }
    }
};

const ReportFactory = [
    { name: "main",    create: argv => new MainReport(argv)    },
    { name: "worker",  create: argv => new WorkerReport()      },
    { name: "cluster", create: argv => new ClusterReport(argv) },
];

module.exports = function(name, argv) {
    let factory = ReportFactory.find( f => f.name === name);
    if (factory) {
        return factory.create(argv);
    }
    return null;
};

module.exports.ERRNO = ERRNO;

/************************************* END **************************************/
