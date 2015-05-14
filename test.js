// TODO: Should replace this with mocha tests

var MockDB = require('./mockDB');

var mockDB = new MockDB();
var coll1 = mockDB.addCollection("test");

mockDB.collection('test', function(err, coll) {
    var testDocument1 = {
        name: 'Test document 1',
        shouldFind: false
    };

    var testDocument2 = {
        name: 'Test document 2',
        shouldFind: true
    };

    coll.insert(testDocument1, function(err, res) {
        if (res.length == 1) {
            console.log('Successfully inserted first test document');

            coll.insert(testDocument2, function(err, res) {
                if (res.length == 1) {
                    console.log('Successfully inserted second test document');
                    coll.find({ shouldFind: true }, function(err, res) {
                        if (res.length == 1) {
                            console.log('Successfully found second inserted document:');
                            console.log(res[0]);
                        } else {
                            console.log('Failed to find second inserted document');
                        }

                        process.exit();
                    });
                } else {
                    console.log('Failed to insert second document');
                }
            });
        } else {
            console.log('Failed to insert first document');
        }
    });
})