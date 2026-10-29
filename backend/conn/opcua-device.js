const opcua = require('node-opcua');
const storage = require('../config/storage');

const portNumber = 4840;

module.exports = {

  async connect() {
    const server = new opcua.OPCUAServer({
      port: portNumber,
      resourcePath: '/UA/IoTSimulator',
      buildInfo: {
        productName: 'IoT Simulator OPC-UA Server',
        buildNumber: '1',
        buildDate: new Date()
      }
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();

    const devicesFolder = namespace.addFolder(addressSpace.rootFolder.objects, {
      browseName: 'IoTDevices'
    });

    const deviceNodes = [
      { deviceId: 1000, browseName: 'Boiler_1000',      props: ['hope_temperature', 'now_temperature', 'humidity', 'mode', 'switch', 'status'] },
      { deviceId: 2000, browseName: 'SmartSwitch_2000', props: ['switch', 'color', 'strength', 'mode', 'status'] },
      { deviceId: 3000, browseName: 'Thermometer_3000', props: ['temperature', 'status'] }
    ];

    deviceNodes.forEach(({ deviceId, browseName, props }) => {
      const deviceNode = namespace.addObject({
        organizedBy: devicesFolder,
        browseName
      });

      props.forEach((propName) => {
        namespace.addVariable({
          componentOf: deviceNode,
          browseName: propName,
          nodeId: `s=${deviceId}_${propName}`,
          dataType: 'String',
          value: {
            get: function () {
              const val = storage.getValue(deviceId, propName) || '';
              return new opcua.Variant({ dataType: opcua.DataType.String, value: val });
            },
            set: function (variant) {
              const writeValue = variant.value;
              console.log('[OPC-UA] Write — deviceId=%d %s=%s', deviceId, propName, writeValue);
              storage.setValue(deviceId, propName, writeValue);
              return opcua.StatusCodes.Good;
            }
          }
        });
      });
    });

    // OPC-UA variables now read directly from storage via get(), no polling needed

    try {
      await server.start();
      console.info('[OPC-UA] Server started — port=%d endpoint=%s', portNumber, server.getEndpointUrl());
    } catch (err) {
      if (err.message && err.message.includes('EADDRINUSE')) {
        console.error('[OPC-UA] Port %d already in use — skipping', portNumber);
      } else {
        console.error('[OPC-UA] Server start failed — %s', err.message);
      }
    }
  }

};
