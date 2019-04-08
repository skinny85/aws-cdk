var AWS = require('aws-sdk');

exports.handler = function (event, context) {
    console.info("Called with Event: " + JSON.stringify(event, null, 2));

    var codepipeline = new AWS.CodePipeline();

    // Retrieve the Job ID from the Lambda action
    var jobId = event['CodePipeline.job'].id;

    // Notify AWS CodePipeline of a successful job
    var params = {
        jobId: jobId,
    };
    codepipeline.putJobSuccessResult(params, function (err, data) {
        if (err) {
            context.fail(err);
        } else {
            context.succeed('Hello from Lambda!');
        }
    });
};
