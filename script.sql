create table iot_boiler
(
    id               int         null comment '고유아이디',
    name             varchar(20) null comment 'iot name',
    firmware         varchar(20) null comment 'firmware version',
    version          varchar(20) null comment 'device version',
    serialNo         varchar(20) null comment 'serialNumber',
    hope_temperature int         null comment 'hope temperature',
    now_temperature  int         null comment 'now temperature',
    switch           tinyint(1)  null comment '전원 onOff',
    humidity         int         null comment 'now humidity',
    mode             int         null comment '(general : 1, save : 2, shower : 3, ondol : 4, out : 5, hot water : 6)',
    status           varchar(20) null comment 'error or normal'
)
    comment 'iot boiler';

INSERT INTO mydb.iot_boiler (id, name, firmware, version, serialNo, hope_temperature, now_temperature, switch, humidity, mode, status) VALUES (1000, '보일러1', '1.0.3', '27', '5910438138', 27, 29, 0, 57, 4, 'normal');
