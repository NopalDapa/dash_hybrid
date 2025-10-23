# cam_min

Paket ROS2 Humble berbasis C++ untuk membuka kamera lokal dan mempublikasikan frame dalam bentuk `sensor_msgs/msg/CompressedImage` dengan penggunaan bandwidth serendah mungkin.

## Fitur
- Resolusi default 320x240 dan mode grayscale untuk mengecilkan ukuran data.
- Kompresi JPEG dengan kualitas yang dapat diatur (`jpeg_quality` default 40).
- Parameter ROS2 untuk mengatur perangkat kamera, resolusi, FPS, dan nama topik.

## Dependensi
- ROS2 Humble (`rclcpp`, `sensor_msgs`).
- OpenCV (melalui `rosdep` key `opencv`).

Instal seluruh dependensi build dengan:

```bash
rosdep install --from-paths . --ignore-src -y
```

## Build
Tambahkan paket ini ke workspace ROS2 (mis. `~/ros2_ws/src`) lalu jalankan:

```bash
colcon build --packages-select cam_min
source install/setup.zsh  # gunakan install/setup.bash jika shell Anda bash
```

## Menjalankan Node

```bash
ros2 run cam_min camera_publisher
```

Parameter penting (bisa dipakai lewat `ros2 run cam_min camera_publisher --ros-args ...`):
- `device_id` (`int`, default `0`) - indeks kamera di sistem.
- `width` / `height` (`int`, default `320` / `240`).
- `fps` (`float`, default `10.0`).
- `color_mode` (`str`, default `gray`, opsi lain `bgr`).
- `jpeg_quality` (`int`, default `40`, rentang 1-95).
- `topic_name` (`str`, default `camera/image/compressed`).
- `frame_id` (`str`, default `camera`).

Contoh menyalakan kamera pada resolusi 640x480 dengan kompresi lebih kuat dan FPS rendah:

```bash
ros2 run cam_min camera_publisher --ros-args -p width:=640 -p height:=480 -p fps:=5.0 -p jpeg_quality:=35
```

Topik terpublikasi menggunakan tipe `sensor_msgs/msg/CompressedImage`. Anda bisa memeriksa ukuran data dengan:

```bash
ros2 topic echo /camera/image/compressed --once
```
