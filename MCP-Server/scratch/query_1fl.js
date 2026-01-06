/**
 * 查询 1FL 房间清单
 */

import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8999');

ws.on('open', function () {
    console.log('=== 查询 1FL 房间清单 ===');

    // 猜测楼层名称为 1FL (因为二楼是 2FL)
    const command = {
        CommandName: 'get_rooms_by_level',
        Parameters: {
            level: '1FL'
        },
        RequestId: 'query_1fl_' + Date.now()
    };

    ws.send(JSON.stringify(command));
});

ws.on('message', function (data) {
    const response = JSON.parse(data.toString());

    if (response.Success) {
        console.log('\n找到', response.Data.TotalRooms, '间房间');
        console.log('楼层:', response.Data.Level);

        console.log('\n房间列表:');
        response.Data.Rooms.forEach(room => {
            console.log(`- [${room.Number}] ${room.Name} (${room.Area} m²)`);
        });
    } else {
        console.log('查询失败:', response.Error);
    }

    ws.close();
});

ws.on('error', function (error) {
    console.error('连接错误:', error.message);
});

ws.on('close', function () {
    process.exit(0);
});

setTimeout(() => {
    console.log('超时');
    ws.close();
    process.exit(1);
}, 30000);
