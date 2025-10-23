document.addEventListener("DOMContentLoaded", function() {
    // Membuat koneksi ke WebSocket ROS2
    var ros = new ROSLIB.Ros({
        url: 'ws://localhost:9090'
    });

    var listener = new ROSLIB.Topic({
        ros: ros,
        name: '/detection_results',  // Nama topik yang sama
        messageType: 'gambar_koordinat/msg/Pcpos'  // Tipe pesan custom sesuai yang ada di ROS2
    });

    listener.subscribe(function(message) {
        console.log('Received message:', message);

        document.getElementById('centerx').textContent = message.centerx;
        document.getElementById('centery').textContent = message.centery;
        document.getElementById('pcid').textContent = message.pcid;
    });

    var publisher = new ROSLIB.Topic({
        ros: ros,
        name: '/counter',  // Nama topik yang sama
        messageType: 'std_msgs/msg/Int32'  // Tipe pesan yang sama
    });

    // Fungsi untuk mengirim data
    function sendData() {
        var message = new ROSLIB.Message({
            // centerx: 1.23,
            // centery: 4.56,
            // pcid: 7.89
            data : 123
        });

        publisher.publish(message);
        console.log('Sent message:', message);
    }

    document.getElementById('sendButton').addEventListener('click', function() {
        sendData();
    });
});
