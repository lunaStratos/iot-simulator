var schedule = require('node-schedule');
const storage = require('./storage');

module.exports = {
    batchStart() {
        schedule.scheduleJob('*/5 * * * * *', () => {
            const humidity = Math.floor(Math.random() * 101);
            const nowtemp = Math.floor(Math.random() * 20) + 16;
            const deviceId = '1000';

            const switchVal = storage.getValue(deviceId, 'switch');
            if (switchVal && switchVal !== '0') {
                storage.setValue(deviceId, 'now_temperature', nowtemp);
                storage.setValue(deviceId, 'humidity', humidity);
            }
        });
    }
};
