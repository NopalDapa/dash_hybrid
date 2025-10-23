#include <rclcpp/rclcpp.hpp>
#include <sensor_msgs/msg/image.hpp>
#include <cv_bridge/cv_bridge.h>
#include <image_transport/image_transport.hpp>
#include <opencv2/opencv.hpp>
#include <rcl_interfaces/msg/parameter_event.hpp>
#include <rcl_interfaces/msg/set_parameters_result.hpp>
#include <string> // For std::string
#include <sstream> // For std::ostringstream
#include <cstdlib> // For std::system

class CameraPublisherNode : public rclcpp::Node {
public:
    CameraPublisherNode()
    : Node("camera_publisher_node"), cap(0) {
        if (!cap.isOpened()) {
            RCLCPP_ERROR(this->get_logger(), "Failed to open camera!");
            rclcpp::shutdown();
            return;
        }

        // Declare parameters
        this->declare_parameter("fps", 30.0);
        this->declare_parameter("brightness", 0.5);
        this->declare_parameter("contrast", 0.5);
        this->declare_parameter("saturation", 0.5);
        this->declare_parameter("hue", 0.5);
        this->declare_parameter("gain", 0.5);
        this->declare_parameter("exposure", 0.5);

        // Get initial parameter values and apply to camera
        apply_camera_parameters();

        // Register parameter callback
        parameter_event_sub_ = this->create_subscription<rcl_interfaces::msg::ParameterEvent>(
            "/parameter_events", 10,
            std::bind(&CameraPublisherNode::on_parameter_event, this, std::placeholders::_1));

        // Set up timer based on initial FPS
        double initial_fps = this->get_parameter("fps").as_double();
        setup_timer(initial_fps);
    }

    void set_publisher(const image_transport::Publisher& pub) {
        pub_ = pub;
    }

private:
    // Helper function to execute v4l2-ctl commands
    bool set_v4l2_parameter(const std::string& param_name, double value) {
        // Assuming /dev/video0 is the camera device
        std::ostringstream cmd;
        cmd << "v4l2-ctl -d /dev/video0 -c " << param_name << "=" << static_cast<int>(value);
        RCLCPP_INFO(this->get_logger(), "Executing v4l2-ctl command: %s", cmd.str().c_str());
        int result = std::system(cmd.str().c_str());
        if (result == 0) {
            RCLCPP_INFO(this->get_logger(), "v4l2-ctl %s set to %f: SUCCESS", param_name.c_str(), value);
            return true;
        } else {
            RCLCPP_ERROR(this->get_logger(), "v4l2-ctl %s set to %f: FAILED (exit code %d)", param_name.c_str(), value, result);
            return false;
        }
    }

    void apply_camera_parameters() {
        bool success;
        // For FPS, we still rely on OpenCV's cap.set and the timer
        success = cap.set(cv::CAP_PROP_FPS, this->get_parameter("fps").as_double());
        RCLCPP_INFO(this->get_logger(), "Setting FPS to %f (OpenCV): %s", this->get_parameter("fps").as_double(), success ? "SUCCESS" : "FAILED");

        // Use v4l2-ctl for other parameters
        set_v4l2_parameter("brightness", this->get_parameter("brightness").as_double() * 255); // Assuming 0-1 maps to 0-255
        set_v4l2_parameter("contrast", this->get_parameter("contrast").as_double() * 255);     // Assuming 0-1 maps to 0-255
        set_v4l2_parameter("saturation", this->get_parameter("saturation").as_double() * 255); // Assuming 0-1 maps to 0-255
        set_v4l2_parameter("hue", this->get_parameter("hue").as_double() * 360 - 180); // Assuming 0-1 maps to -180 to 180
        set_v4l2_parameter("gain", this->get_parameter("gain").as_double() * 100);     // Assuming 0-1 maps to 0-100
        set_v4l2_parameter("exposure_absolute", this->get_parameter("exposure").as_double() * 1000); // Assuming 0-1 maps to 0-1000 (ms)

        RCLCPP_INFO(this->get_logger(), "Applied initial camera parameters.");
    }

    void setup_timer(double fps) {
        if (timer_) {
            timer_->cancel(); // Cancel existing timer if any
        }
        if (fps > 0) {
            long long period_ms = static_cast<long long>(1000.0 / fps);
            timer_ = this->create_wall_timer(
                std::chrono::milliseconds(period_ms),
                std::bind(&CameraPublisherNode::timer_callback, this)
            );
            RCLCPP_INFO(this->get_logger(), "Timer set to %f FPS (period: %lld ms).", fps, period_ms);
        } else {
            RCLCPP_WARN(this->get_logger(), "FPS is zero or negative, timer not started.");
        }
    }

    void timer_callback() {
        cv::Mat frame;
        cap >> frame;
        if (frame.empty()) {
            RCLCPP_WARN(this->get_logger(), "Failed to capture frame.");
            return;
        }

        std_msgs::msg::Header header;
        header.stamp = this->now();
        header.frame_id = "camera_frame";

        // Publish as compressed image
        auto cv_ptr = cv_bridge::CvImage(header, "bgr8", frame);
        sensor_msgs::msg::Image::SharedPtr img_msg = cv_ptr.toImageMsg();
        pub_.publish(img_msg);
    }

    void on_parameter_event(const rcl_interfaces::msg::ParameterEvent::SharedPtr event) {
        RCLCPP_INFO(this->get_logger(), "Received parameter event from node: %s", event->node.c_str());
        // Filter for events from this node
        // The event->node might not be this node's name when parameters are set via rosbridge.
        // Instead, we check if the changed parameter's name starts with this node's name.
        std::string node_name_prefix = "/" + std::string(this->get_name()) + "/";

        for (const auto& changed_parameter : event->changed_parameters) {
            if (changed_parameter.name.rfind(node_name_prefix, 0) == 0) { // Check if parameter name starts with node_name_prefix
                bool success;
                // Extract the actual parameter name without the node prefix
                std::string param_name_only = changed_parameter.name.substr(node_name_prefix.length());

                if (param_name_only == "fps") {
                    double new_fps = changed_parameter.value.double_value;
                    success = cap.set(cv::CAP_PROP_FPS, new_fps);
                    setup_timer(new_fps); // Recreate timer with new period
                    RCLCPP_INFO(this->get_logger(), "FPS changed to %f (OpenCV): %s", new_fps, success ? "SUCCESS" : "FAILED");
                } else if (param_name_only == "brightness") {
                    set_v4l2_parameter("brightness", changed_parameter.value.double_value * 255);
                } else if (param_name_only == "contrast") {
                    set_v4l2_parameter("contrast", changed_parameter.value.double_value * 255);
                } else if (param_name_only == "saturation") {
                    set_v4l2_parameter("saturation", changed_parameter.value.double_value * 255);
                } else if (param_name_only == "hue") {
                    set_v4l2_parameter("hue", changed_parameter.value.double_value * 360 - 180);
                } else if (param_name_only == "gain") {
                    set_v4l2_parameter("gain", changed_parameter.value.double_value * 100);
                } else if (param_name_only == "exposure") {
                    set_v4l2_parameter("exposure_absolute", changed_parameter.value.double_value * 1000);
                }
            }
        }
    }

    image_transport::Publisher pub_;
    rclcpp::TimerBase::SharedPtr timer_;
    cv::VideoCapture cap;
    rclcpp::Subscription<rcl_interfaces::msg::ParameterEvent>::SharedPtr parameter_event_sub_;
};

int main(int argc, char * argv[]) {
    rclcpp::init(argc, argv);

    auto node = std::make_shared<CameraPublisherNode>();

    image_transport::ImageTransport it(node);
    node->set_publisher(it.advertise("camera/image/compressed", 1));

    rclcpp::spin(node);
    rclcpp::shutdown();
    return 0;
}
