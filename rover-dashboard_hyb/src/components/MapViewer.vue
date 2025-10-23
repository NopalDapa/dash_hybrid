<template>
  <div ref="mapContainer" id="map" class="rviz-viewer"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as ROSLIB from 'roslib';
import Konva from 'konva'; // Import Konva
import { useROS } from '../composables/useRos';

// Robot class and global variables
class Robot {
    constructor(ip, conv_circle, conv_line, x, y, theta, radius) {
        this.ip = ip;
        this.conv_circle = conv_circle;
        this.conv_line = conv_line;
        this.x = x;
        this.y = y;
        this.theta = theta;
        this.radius = radius;
        this.routes = [];
        this.routes_line = [];

        this.color_r = 0;
        this.color_g = 0;
        this.color_b = 0;

        this.has_finished_routes_init = false;
        this.prev_has_finished_routes_init = false;
        this.has_route_drawed = false;
    }
}

let robots = [];
let posisi_robot = 0; // 0 = kiri, 1 = kanan
let wtf_skala = 100;

// Vue refs for container and ROS connection
const mapContainer = ref(null);
const { ros, isConnected } = useROS();

// Konva stage and layers
let stage = null;
let gridLayer = null;
let robotLayer = null;
let mapLayer = null;
let lidarLayer = null;
let waypointsLayer = null;
let terminalsLayer = null;
let filteredLidarLayer = null;

// Map related variables
let last_time_update_map = 0;
let mapCanvas = document.createElement("canvas");
let mapCtx = mapCanvas.getContext("2d");

// Waypoints lines storage
const lines = {
    utama: null,
    kanan: null,
    kiri: null,
    tengah: null,
};

// ROS topic publishers/subscribers
let robotTopic = null;
let lidarTopic = null;
let waypointsTopic = null;
let mapRosTopic = null; // Renamed to avoid conflict with mapLayer

const lidar_tf_x = 0.15;
const lidar_tf_y = 0.0;
const lidar_tf_theta = 0;

// ================================================================================================================================
// Konva Initialization
const initKonva = () => {
    if (mapContainer.value && ros.value && isConnected.value) {
        stage = new Konva.Stage({
            container: 'map',
            width: mapContainer.value.clientWidth,
            height: mapContainer.value.clientHeight,
        });

        gridLayer = new Konva.Layer();
        robotLayer = new Konva.Layer();
        mapLayer = new Konva.Layer();
        lidarLayer = new Konva.Layer();
        waypointsLayer = new Konva.Layer();
        terminalsLayer = new Konva.Layer();
        filteredLidarLayer = new Konva.Layer();

        stage.add(mapLayer);
        stage.add(gridLayer);
        stage.add(waypointsLayer);
        stage.add(terminalsLayer);
        stage.add(lidarLayer);
        stage.add(filteredLidarLayer);
        stage.add(robotLayer);

        // Draw the grid
        const gridSize = 50;
        for (let x = 0; x < stage.width(); x += gridSize) {
            gridLayer.add(
                new Konva.Line({
                    points: [x, 0, x, stage.height()],
                    stroke: '#ddd',
                    strokeWidth: 1,
                })
            );
        }
        for (let y = 0; y < stage.height(); y += gridSize) {
            gridLayer.add(
                new Konva.Line({
                    points: [0, y, stage.width(), y],
                    stroke: '#ddd',
                    strokeWidth: 1,
                })
            );
        }
        gridLayer.draw();

        // Enable zooming
        stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const scaleBy = 1.1;
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
            stage.scale({ x: newScale, y: newScale });

            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            stage.position(newPos);
            stage.batchDraw();
        });

        // Enable map shifting (panning) with the right mouse button
        let isDragging = false;
        let dragStartPos = { x: 0, y: 0 };

        stage.on('mousedown', (e) => {
            if (e.evt.button === 2 || e.evt.button === 1) { // Check if the right or middle mouse button is pressed
                isDragging = true;
                dragStartPos = stage.getPointerPosition();
            }
        });

        stage.on('mousemove', (e) => {
            if (!isDragging) return;

            const pointer = stage.getPointerPosition();
            const dx = pointer.x - dragStartPos.x;
            const dy = pointer.y - dragStartPos.y;

            stage.position({
                x: stage.x() + dx,
                y: stage.y() + dy,
            });
            stage.batchDraw();
            dragStartPos = pointer;
        });

        stage.on('mouseup', () => {
            isDragging = false;
        });

        stage.on('contextmenu', (e) => {
            // Prevent the browser's context menu from appearing on right-click
            e.evt.preventDefault();
        });

        // Handle window resizing
        window.addEventListener('resize', resizeKonva);

        // Initialize ROS topic subscriptions
        initRosSubscriptions();
    }
};

const resizeKonva = () => {
    if (stage && mapContainer.value) {
        stage.width(mapContainer.value.clientWidth);
        stage.height(mapContainer.value.clientHeight);

        gridLayer.batchDraw();
        robotLayer.batchDraw();
        mapLayer.batchDraw();
        lidarLayer.batchDraw();
        waypointsLayer.batchDraw();
        terminalsLayer.batchDraw();
        filteredLidarLayer.batchDraw();
    }
};

const destroyKonva = () => {
    if (stage) {
        stage.destroy();
        stage = null;
        gridLayer = null;
        robotLayer = null;
        mapLayer = null;
        lidarLayer = null;
        waypointsLayer = null;
        terminalsLayer = null;
        filteredLidarLayer = null;
    }
    window.removeEventListener('resize', resizeKonva);
    destroyRosSubscriptions();
};

// ================================================================================================================================
// Robot Drawing
function addRobot(ip, x, y, theta, radius, colourr) {
    const original_x = x;
    const original_y = y;
    const original_theta = theta;

    x = x + stage.width() * 0.5 / wtf_skala;
    y = stage.height() * 0.5 / wtf_skala - y;
    theta = theta;
    radius = radius;

    for (let i = 0; i < robots.length; i++) {
        if (robots[i].ip == ip) {
            robots[i].conv_circle.position({ x: x * wtf_skala, y: y * wtf_skala });
            robots[i].conv_line.points([x * wtf_skala, y * wtf_skala, x * wtf_skala + radius * wtf_skala * Math.cos(theta), y * wtf_skala - radius * wtf_skala * Math.sin(theta)]);
            robots[i].x = original_x;
            robots[i].y = original_y;
            robots[i].theta = original_theta;
            robots[i].radius = radius;
            robots[i].conv_circle.fill(colourr);

            robotLayer.batchDraw();
            return;
        }
    }

    const conv_circle = new Konva.Circle({
        x: x * wtf_skala,
        y: y * wtf_skala,
        radius: radius * wtf_skala,
        fill: colourr,
        draggable: true,
    });

    const thetaRadians = theta;
    const lineEndX = x * wtf_skala + radius * wtf_skala * Math.cos(thetaRadians);
    const lineEndY = y * wtf_skala - radius * wtf_skala * Math.sin(thetaRadians);

    const conv_line = new Konva.Line({
        points: [x * wtf_skala, y * wtf_skala, lineEndX, lineEndY],
        stroke: 'Cyan',
        strokeWidth: 5,
    });

    let robot_buffer = new Robot(ip, conv_circle, conv_line, x, y, theta, radius);
    robots.push(robot_buffer);
    robotLayer.add(robot_buffer.conv_circle);
    robotLayer.add(robot_buffer.conv_line);
    robotLayer.draw();
}

// ================================================================================================================================
// ROS Subscriptions and Services
const initRosSubscriptions = () => {
    if (!ros.value || !isConnected.value) return;

    // topic odom robot
    robotTopic = new ROSLIB.Topic({
        ros: ros.value,
        name: '/slam/odometry/filtered',
        messageType: 'nav_msgs/Odometry'
    });

    robotTopic.subscribe(function (message) {
        const x = message.pose.pose.position.x;
        const y = message.pose.pose.position.y;
        const q = message.pose.pose.orientation;
        const theta = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
        const radius = 0.15;

        if (posisi_robot == 0) {
            addRobot("0.0.0.0", x, y, theta, radius, 'magenta');
        } else if (posisi_robot == 1) {
            addRobot("0.0.0.0", x, y, theta, radius, 'yellow');
        }
    });

    // topic lidar
    lidarTopic = new ROSLIB.Topic({
        ros: ros.value,
        name: '/vision/laserscan',
        messageType: 'sensor_msgs/LaserScan'
    });

    lidarTopic.subscribe(function (message) {
        if (robots.length == 0) {
            return;
        }

        const ranges = message.ranges;
        const angleIncrement = message.angle_increment;
        const angleMin = message.angle_min + (robots[0].theta);

        const rotated_x = lidar_tf_x * Math.cos(robots[0].theta) - lidar_tf_y * Math.sin(robots[0].theta);
        const rotated_y = lidar_tf_x * Math.sin(robots[0].theta) + lidar_tf_y * Math.cos(robots[0].theta);

        const laserPoints = [];
        for (let i = 0; i < ranges.length; i++) {
            const angle = angleMin + i * angleIncrement;
            let x = ranges[i] * Math.cos(angle) + robots[0].x + rotated_x;
            let y = ranges[i] * Math.sin(angle) + robots[0].y + rotated_y;

            x = x + stage.width() * 0.5 / wtf_skala;
            y = stage.height() * 0.5 / wtf_skala - y;

            x = x * wtf_skala;
            y = y * wtf_skala;

            laserPoints.push(x, y);
        }

        lidarLayer.destroyChildren();
        const laserLine = new Konva.Line({
            points: laserPoints,
            stroke: 'red',
            strokeWidth: 1,
        });
        lidarLayer.add(laserLine);
        lidarLayer.draw();
    });

    // topic waypoints
    waypointsTopic = new ROSLIB.Topic({
        ros: ros.value,
        name: '/master/waypoints',
        messageType: 'sensor_msgs/PointCloud'
    });
    waypointsTopic.subscribe((message) => {
        drawWaypoints(message.points, 'blue', 'utama');
    });

    // topic map
    mapRosTopic = new ROSLIB.Topic({
        ros: ros.value,
        name: '/slam/map',
        messageType: 'nav_msgs/OccupancyGrid'
    });
    mapRosTopic.subscribe(function (message) {
        if (new Date().getTime() - last_time_update_map < 1000) {
            return;
        }
        last_time_update_map = new Date().getTime();

        let map = message.data;
        let width = message.info.width;
        let height = message.info.height;

        mapCanvas.width = width;
        mapCanvas.height = height;

        let imageData = mapCtx.createImageData(width, height);
        for (let i = 0; i < map.length; i++) {
            let occupancy = map[i];
            let r, g, b;

            if (occupancy === -1) {
                r = 71; g = 128; b = 118;
            } else if (occupancy === 0) {
                r = 255; g = 255; b = 255;
            } else {
                let t = occupancy / 100;
                r = 0;
                g = Math.round(165 - t * 165);
                b = 0;
            }

            imageData.data[i * 4 + 0] = r;
            imageData.data[i * 4 + 1] = g;
            imageData.data[i * 4 + 2] = b;
            imageData.data[i * 4 + 3] = 255;
        }
        mapCtx.putImageData(imageData, 0, 0);

        let imageObj = new Image();
        imageObj.onload = function () {
            let mapImage = new Konva.Image({
                image: imageObj,
                width: width * wtf_skala * message.info.resolution,
                height: height * wtf_skala * message.info.resolution,
                x: (message.info.origin.position.x + stage.width() * 0.5 / wtf_skala) * wtf_skala,
                y: (stage.height() * 0.5 / wtf_skala - message.info.origin.position.y) * wtf_skala,
            });

            mapImage.scaleY(-1);
            mapLayer.destroyChildren();
            mapLayer.add(mapImage);
            mapLayer.draw();
        };
        imageObj.src = mapCanvas.toDataURL();
    });
};

const destroyRosSubscriptions = () => {
    if (robotTopic) robotTopic.unsubscribe();
    if (lidarTopic) lidarTopic.unsubscribe();
    if (waypointsTopic) waypointsTopic.unsubscribe();
    if (mapRosTopic) mapRosTopic.unsubscribe();
};

// Waypoints drawing function
function drawWaypoints(points, color, key) {
    const transformedPoints = [];

    for (let i = 0; i < points.length; i++) {
        const x = points[i].x;
        const y = points[i].y;

        const x_tf = x + stage.width() * 0.5 / wtf_skala;
        const y_tf = stage.height() * 0.5 / wtf_skala - y;

        transformedPoints.push(x_tf * wtf_skala, y_tf * wtf_skala);
    }

    if (lines[key]) {
        lines[key].destroy();
    }

    const newLine = new Konva.Line({
        points: transformedPoints,
        stroke: color,
        strokeWidth: 5,
        lineJoin: 'round',
    });

    waypointsLayer.add(newLine);
    lines[key] = newLine;
    waypointsLayer.draw();
}

onMounted(() => {
    if (mapContainer.value) {
        mapContainer.value.id = 'map'; // Ensure the container has the ID 'map'
    }

    watch([ros, isConnected], ([newRos, newIsConnected]) => {
        if (newRos && newIsConnected && !stage) {
            initKonva();
        } else if ((!newRos || !newIsConnected) && stage) {
            destroyKonva();
        }
    }, { immediate: true });
});

onUnmounted(() => {
    destroyKonva();
});
</script>

<style scoped>
.rviz-viewer {
  width: 100%;
  height: 100%;
  background-color: #333333;
}
</style>
