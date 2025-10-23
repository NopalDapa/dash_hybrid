# Rival Dashboard for ARCh 2026.  

## Getting Started.  

### 1. Clone this repo:

Using bash or other terminal

```
git clone https://github.com/yosuahres/rover-dashboard.git
```

### 2. Install Dependencies
It is encouraged to use **pnpm** so the packages can work properly.

```bash
pnpm install
```

### 3. Run Development Server (Web)
You can start the web server using this command:
```bash
pnpm dev
```

Open [http://localhost:6969](http://localhost:6969) with your browser to see the result.

### 4. Desktop Application (Tauri)

This project can also be run as a native desktop application using Tauri.

#### Prerequisites for Tauri Development:
Before running or building the desktop application, ensure you have the necessary Tauri development prerequisites installed:
*   **Rust:** Follow the instructions on [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install).
*   **System Dependencies:**
    *   **macOS:** Run `xcode-select --install` in your terminal.
    *   **Windows:** Install Microsoft Visual Studio C++ Build Tools and WebView2. Refer to the [Tauri Prerequisites Guide](https://tauri.app/v1/guides/getting-started/prerequisites/) for detailed instructions.
    *   **Linux:** Install `webkit2gtk` and other development libraries specific to your distribution. Refer to the [Tauri Prerequisites Guide](https://tauri.app/v1/guides/getting-started/prerequisites/) for detailed instructions.

#### Run Desktop Development Build:
To run the desktop application in development mode:
```bash
pnpm tauri dev
```

#### Build Desktop Application:
To build the production-ready desktop installer:
```bash
pnpm tauri build
```
The installer files will be located in `src-tauri/target/release/bundle/`.

### 5. Install Requirements
1. Rosbridge

   ```
   sudo apt install ros-<ROS_DISTRO>-rosbridge-server

   source /opt/ros/<ROS_DISTRO>/setup.bash (or .zsh)

   #launch rosbridge on terminal  
   ros2 launch rosbridge_server rosbridge_websocket_launch.xml

   #change to your robot IP
   ros2 launch rosbridge_server rosbridge_websocket_launch.xml address:=0.0.0.0 port:=9090
   ```

2. Web video server, refer to [this](https://github.com/RobotWebTools/web_video_server).  
For newer ROS2 distributions (humble, jazzy, rolling) it is possible to install web_video_server as a package:
    ```
    sudo apt install ros-${ROS_DISTRO}-web-video-server

    # ROS 2
    ros2 run web_video_server web_video_server

    #change to your robot IP
    ros2 run web_video_server web_video_server --ros-args -p port:=8081 -p address:=localhost -p server_threads:=4
    ```

### 6. Commit message
This project uses the conventional commit specification for better readability and clarity. It is mandatory to use conventional commit messages. Read more about conventional commits [here](https://www.conventionalcommits.org/en/v1.0.0/).

## ⁉️ author?   

king hares.
