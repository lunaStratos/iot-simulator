* IoT Simulator for HTTP MQTT CoAP LwM2M


IoT서버의 client 통신 테스트를 위해서 가상의IoT 기기를 만들었습니다.

* 동작방법

./script.sh 로 실행하면 frontend 의 빌드와 함께 backend의 실행이 됨


''
localhost:3000/api/iot/status/:deviceId
localhost:3000/api/iot/control/:deviceControlName
''

```
Content-Type : application/json
```