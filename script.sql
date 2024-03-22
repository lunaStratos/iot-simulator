create table iot_device
(
    id       int         null comment '고유아이디',
    name     varchar(20) null comment 'iot name',
    firmware varchar(20) null comment 'firmware version',
    version  varchar(20) null comment 'device version',
    serialNo varchar(20) null comment 'serialNumber'
)
    comment 'iot boiler';

insert into mydb.iot_device (id, name, firmware, version, serialNo)
values  (1000, '보일러1', '1.0.3', '27', '5910438138'),
        (2000, '스마트스위치', '1.0.0', '22', '492992343');

create table iot_device_value
(
    id   int         null,
    name varchar(20) not null,
    val  varchar(30) null
);


insert into mydb.iot_device_value (id, name, val)
values  (1000, 'hope_temperature', '27'),
        (1000, 'now_temperature', '50'),
        (1000, 'mode', '5'),
        (1000, 'switch', '1'),
        (1000, 'status', 'normal'),
        (1000, 'humidity', '40'),
        (2000, 'switch', '0'),
        (2000, 'color', '1'),
        (2000, 'strength', '80'),
        (2000, 'mode', '2'),
        (2000, 'status', 'normal');