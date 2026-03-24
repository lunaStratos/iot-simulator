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

    const boilerNode = namespace.addObject({
      organizedBy: devicesFolder,
      browseName: 'Boiler_1000'
    });

    const boilerProps = ['hope_temperature', 'now_temperature', 'humidity', 'mode', 'switch', 'status'];
    boilerProps.forEach((propName) => {
      namespace.addVariable({
        componentOf: boilerNode,
        browseName: propName,
        nodeId: `s=1000_${propName}`,
        dataType: 'String',
        value: {
          get: function () {
            const val = storage.getValue(1000, propName) || '';
            return new opcua.Variant({ dataType: opcua.DataType.String, value: val });
          },
          set: function (variant) {
            const writeValue = variant.value;
            console.log('[OPC-UA] Write — deviceId=1000 %s=%s', propName, writeValue);
            storage.setValue(1000, propName, writeValue);
            return opcua.StatusCodes.Good;
          }
        }
      });
    });

    const switchNode = namespace.addObject({
      organizedBy: devicesFolder,
      browseName: 'SmartSwitch_2000'
    });

    const switchProps = ['switch', 'color', 'strength', 'mode', 'status'];
    switchProps.forEach((propName) => {
      namespace.addVariable({
        componentOf: switchNode,
        browseName: propName,
        nodeId: `s=2000_${propName}`,
        dataType: 'String',
        value: {
          get: function () {
            const val = storage.getValue(2000, propName) || '';
            return new opcua.Variant({ dataType: opcua.DataType.String, value: val });
          },
          set: function (variant) {
            const writeValue = variant.value;
            console.log('[OPC-UA] Write — deviceId=2000 %s=%s', propName, writeValue);
            storage.setValue(2000, propName, writeValue);
            return opcua.StatusCodes.Good;
          }
        }
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
