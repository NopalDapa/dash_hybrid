#include <algorithm>
#include <chrono>
#include <cctype>
#include <memory>
#include <string>
#include <vector>

#include <opencv2/imgcodecs.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/videoio.hpp>

#include "rclcpp/rclcpp.hpp"
#include "sensor_msgs/msg/compressed_image.hpp"
#include "sensor_msgs/msg/image.hpp"

using namespace std::chrono_literals;

class MinimalCameraPublisher : public rclcpp::Node
{
public:
  MinimalCameraPublisher()
  : rclcpp::Node("minimal_camera_publisher")
  {
    device_id_ = declare_parameter<int>("device_id", 0);
    width_ = declare_parameter<int>("width", 320);
    height_ = declare_parameter<int>("height", 240);
    double fps = declare_parameter<double>("fps", 10.0);
    color_mode_ = declare_parameter<std::string>("color_mode", "gray");
    std::transform(
      color_mode_.begin(), color_mode_.end(), color_mode_.begin(),
      [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    jpeg_quality_ = declare_parameter<int>("jpeg_quality", 40);
    compressed_topic_name_ = declare_parameter<std::string>("compressed_topic_name", "/camera/image/compressed");
    if (!compressed_topic_name_.empty() && compressed_topic_name_.front() != '/') {
      compressed_topic_name_.insert(compressed_topic_name_.begin(), '/');
    }
    const auto legacy_topic = declare_parameter<std::string>("topic_name", compressed_topic_name_);
    if (!legacy_topic.empty()) {
      compressed_topic_name_ = legacy_topic;
      if (compressed_topic_name_.front() != '/') {
        compressed_topic_name_.insert(compressed_topic_name_.begin(), '/');
      }
    }
    raw_topic_name_ = declare_parameter<std::string>("raw_topic_name", "/camera/image_raw");
    if (!raw_topic_name_.empty() && raw_topic_name_.front() != '/') {
      raw_topic_name_.insert(raw_topic_name_.begin(), '/');
    }
    frame_id_ = declare_parameter<std::string>("frame_id", "camera");

    compressed_publisher_ = create_publisher<sensor_msgs::msg::CompressedImage>(compressed_topic_name_, rclcpp::SensorDataQoS());
    raw_publisher_ = create_publisher<sensor_msgs::msg::Image>(raw_topic_name_, rclcpp::SensorDataQoS());

    if (fps <= 0.0) {
      RCLCPP_WARN(get_logger(), "FPS must be positive; defaulting to 10.0");
      fps = 10.0;
    }
    publish_period_ = std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::duration<double>(1.0 / fps));

    open_capture();

    timer_ = create_wall_timer(publish_period_, std::bind(&MinimalCameraPublisher::publish_frame, this));
  }

private:
  void open_capture()
  {
    capture_ = std::make_unique<cv::VideoCapture>(device_id_, cv::CAP_ANY);

    if (!capture_ || !capture_->isOpened()) {
      RCLCPP_ERROR(get_logger(), "Unable to open camera device %d. Check permissions and availability.", device_id_);
      return;
    }

    if (width_ > 0) {
      capture_->set(cv::CAP_PROP_FRAME_WIDTH, static_cast<double>(width_));
    }
    if (height_ > 0) {
      capture_->set(cv::CAP_PROP_FRAME_HEIGHT, static_cast<double>(height_));
    }
  }

  void publish_frame()
  {
    if (!capture_ || !capture_->isOpened()) {
      return;
    }

    cv::Mat frame;
    if (!capture_->read(frame) || frame.empty()) {
      RCLCPP_WARN(get_logger(), "Failed to read frame from camera.");
      return;
    }

    cv::Mat encoded_source;
    if (color_mode_ == "gray") {
      cv::cvtColor(frame, encoded_source, cv::COLOR_BGR2GRAY);
    } else if (color_mode_ == "bgr") {
      encoded_source = frame;
    } else {
      RCLCPP_WARN_ONCE(get_logger(), "Unsupported color_mode '%s'. Falling back to 'gray'.", color_mode_.c_str());
      cv::cvtColor(frame, encoded_source, cv::COLOR_BGR2GRAY);
    }

    std::vector<int> encode_params = {cv::IMWRITE_JPEG_QUALITY, std::clamp(jpeg_quality_, 1, 95)};
    std::vector<uchar> buffer;
    if (!cv::imencode(".jpg", encoded_source, buffer, encode_params)) {
      RCLCPP_WARN(get_logger(), "Failed to encode frame.");
      return;
    }

    auto msg = sensor_msgs::msg::CompressedImage();
    msg.header.stamp = now();
    msg.header.frame_id = frame_id_;
    msg.format = "jpeg";
    msg.data = std::move(buffer);
    compressed_publisher_->publish(std::move(msg));

    publish_raw_frame(frame);
  }

  void publish_raw_frame(const cv::Mat & frame)
  {
    if (!raw_publisher_) {
      return;
    }

    cv::Mat continuous_frame = frame;
    if (!frame.isContinuous()) {
      continuous_frame = frame.clone();
    }

    auto msg = sensor_msgs::msg::Image();
    msg.header.stamp = now();
    msg.header.frame_id = frame_id_;
    msg.height = static_cast<uint32_t>(continuous_frame.rows);
    msg.width = static_cast<uint32_t>(continuous_frame.cols);
    msg.is_bigendian = false;
    msg.step = static_cast<sensor_msgs::msg::Image::_step_type>(continuous_frame.cols * continuous_frame.elemSize());

    switch (continuous_frame.channels()) {
      case 1:
        msg.encoding = "mono8";
        break;
      case 3:
        msg.encoding = "bgr8";
        break;
      default:
        RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 2000, "Unsupported channel count %d for raw frame", continuous_frame.channels());
        return;
    }

    msg.data.assign(continuous_frame.datastart, continuous_frame.dataend);
    raw_publisher_->publish(std::move(msg));
  }

  std::unique_ptr<cv::VideoCapture> capture_;
  rclcpp::Publisher<sensor_msgs::msg::CompressedImage>::SharedPtr compressed_publisher_;
  rclcpp::Publisher<sensor_msgs::msg::Image>::SharedPtr raw_publisher_;
  rclcpp::TimerBase::SharedPtr timer_;

  std::string compressed_topic_name_;
  std::string raw_topic_name_;
  std::string frame_id_;
  std::string color_mode_;
  int device_id_;
  int width_;
  int height_;
  int jpeg_quality_;
  std::chrono::nanoseconds publish_period_;
};

int main(int argc, char * argv[])
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<MinimalCameraPublisher>();
  rclcpp::spin(node);
  rclcpp::shutdown();
  return 0;
}
