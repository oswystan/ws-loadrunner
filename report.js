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

const ERRNO = {
    SUCC             : 0,
    SERVER_ERR       : 1,
    CONN_ERR         : 2,
    INVAL            : 3,
    MODULE_NOT_FOUND : 4,
    EPERM            : 5,
};

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
        this.url               = argv.url;
        this.connections       = argv.amount;
        this.cocurrency        = argv.cocurrency;
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

    start() {
        this.start_time = new Date();
    }
    stop() {
        this.end_time = new Date();
        this.duration_in_sec = (this.end_time - this.start_time) / 1000;
        this.tps = this.total_request / this.duration_in_sec;
        this.avg_response_ms = this.total_response_ms / this.total_request;
    }
    worker_report(report) {
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
        let a = '\n';
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
        this.workers = argv.worker;
        this.workers_succ = 0;
        this.workers_fail = 0;
        this.app = argv.name;
        this.main = new MainReport(argv);
    }

    jsonify() {
        return {};
    }

    stringify() {
        let ret = "";
        return ret;
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
