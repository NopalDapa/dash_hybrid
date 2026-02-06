#include <rclcpp/rclcpp.hpp>

#include <chrono>

#include <tf2/utils.h>
#include <geometry_msgs/msg/pose2_d.hpp>
#include <geometry_msgs/msg/twist.hpp>
#include <nav_msgs/msg/odometry.hpp>

#include <tf2_ros/transform_listener.h>
#include <tf2_ros/buffer.h>
#include <tf2_geometry_msgs/tf2_geometry_msgs.hpp>

#include <global_interfaces/msg/robot_state.hpp>

class RobotStateNode : public rclcpp::Node
{
public:
  // ===============================================================
  // Publishers
  // ===============================================================
  rclcpp::Publisher<geometry_msgs::msg::Pose2D>::SharedPtr pose_pub_;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr vel_pub_;
  rclcpp::Publisher<global_interfaces::msg::RobotState>::SharedPtr state_pub_;
  // NOTE: /mode_switch ownership is on the UI side (dashboard) so we don't
  // continuously override user-selected mode from here.
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_out_pub_;
  rclcpp::Publisher<nav_msgs::msg::Odometry>::SharedPtr odom_out_pub_;

  // ===============================================================
  // Subscribers
  // ===============================================================
  rclcpp::Subscription<nav_msgs::msg::Odometry>::SharedPtr odom_sub_;
  rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr cmd_in_sub_;
  rclcpp::Subscription<nav_msgs::msg::Odometry>::SharedPtr odom_gui_sub_;


  rclcpp::TimerBase::SharedPtr timer_;

  nav_msgs::msg::Odometry last_real_odom_;
  nav_msgs::msg::Odometry last_gui_odom_;
  geometry_msgs::msg::Twist last_real_twist_;
  geometry_msgs::msg::Twist last_gui_twist_;
  bool have_real_odom_{false};
  bool have_gui_odom_{false};
  std::chrono::steady_clock::time_point last_real_odom_wall_;
  std::chrono::steady_clock::time_point last_gui_odom_wall_;
  static constexpr std::chrono::milliseconds ODOM_FRESH_TIMEOUT{200};

  tf2_ros::Buffer tf_buffer_;
  tf2_ros::TransformListener tf_listener_;

  RobotStateNode() : Node("robot_state_node"),
                     tf_buffer_(this->get_clock()),
                     tf_listener_(tf_buffer_)
  {
    pose_pub_ = this->create_publisher<geometry_msgs::msg::Pose2D>(
        "/robot_pose2d", 10);

    vel_pub_ = this->create_publisher<geometry_msgs::msg::Twist>(
        "/robot_velocity", 10);

    state_pub_ = this->create_publisher<global_interfaces::msg::RobotState>(
        "/robot_state", 10);


    // bridge UI teleop -> robot command
    cmd_out_pub_ = this->create_publisher<geometry_msgs::msg::Twist>(
        "/cmd_vel", 10);
    odom_out_pub_ = this->create_publisher<nav_msgs::msg::Odometry>(
        "/odom", 10);

    rclcpp::SubscriptionOptions odom_sub_opts;
    // Prevent feedback when this node injects GUI odom into /odom.
    odom_sub_opts.ignore_local_publications = true;
    odom_sub_ = this->create_subscription<nav_msgs::msg::Odometry>(
        "/odom", 10,
        std::bind(&RobotStateNode::odomCallback, this, std::placeholders::_1),
        odom_sub_opts);

    cmd_in_sub_ = this->create_subscription<geometry_msgs::msg::Twist>(
        "/konva_cmd_vel", 10,
        std::bind(&RobotStateNode::cmdCallback, this, std::placeholders::_1));

    odom_gui_sub_ = this->create_subscription<nav_msgs::msg::Odometry>(
        "/konva_odom", 10,
        std::bind(&RobotStateNode::odomGuiCallback, this, std::placeholders::_1));

    timer_ = this->create_wall_timer(
        std::chrono::milliseconds(50),
        std::bind(&RobotStateNode::timerCallback, this));
  }

private:
  bool realOdomFresh() const
  {
    return have_real_odom_ &&
           (std::chrono::steady_clock::now() - last_real_odom_wall_) < ODOM_FRESH_TIMEOUT;
  }

  bool guiOdomFresh() const
  {
    return have_gui_odom_ &&
           (std::chrono::steady_clock::now() - last_gui_odom_wall_) < ODOM_FRESH_TIMEOUT;
  }

  void cmdCallback(const geometry_msgs::msg::Twist::SharedPtr msg)
  {
    // forward teleop command to the actual robot controller
    cmd_out_pub_->publish(*msg);
  }

  void odomCallback(const nav_msgs::msg::Odometry::SharedPtr msg)
  {
    last_real_odom_ = *msg;
    last_real_twist_ = msg->twist.twist;
    have_real_odom_ = true;
    last_real_odom_wall_ = std::chrono::steady_clock::now();
  }

  void odomGuiCallback(const nav_msgs::msg::Odometry::SharedPtr msg)
  {
    last_gui_odom_ = *msg;
    last_gui_twist_ = msg->twist.twist;
    have_gui_odom_ = true;
    last_gui_odom_wall_ = std::chrono::steady_clock::now();

    // Only inject GUI odom into /odom when no real odom is flowing.
    if (!realOdomFresh())
    {
      odom_out_pub_->publish(*msg);
    }
  }

  void timerCallback()
  {
    geometry_msgs::msg::Pose2D pose;
    geometry_msgs::msg::Twist twist;

    if (realOdomFresh())
    {
      pose.x = last_real_odom_.pose.pose.position.x;
      pose.y = last_real_odom_.pose.pose.position.y;
      pose.theta = tf2::getYaw(last_real_odom_.pose.pose.orientation);
      twist = last_real_twist_;
    }
    else if (guiOdomFresh())
    {
      pose.x = last_gui_odom_.pose.pose.position.x;
      pose.y = last_gui_odom_.pose.pose.position.y;
      pose.theta = tf2::getYaw(last_gui_odom_.pose.pose.orientation);
      twist = last_gui_twist_;
    }
    else
    {
      geometry_msgs::msg::TransformStamped tf;

      if (!tf_buffer_.canTransform("odom", "base_footprint", tf2::TimePointZero, tf2::durationFromSec(0.1)))
        return;

      try
      {
        tf = tf_buffer_.lookupTransform(
            "odom", "base_footprint", tf2::TimePointZero);
      }
      catch (tf2::TransformException &ex)
      {
        RCLCPP_WARN_THROTTLE(
            this->get_logger(), *this->get_clock(), 2000,
            "TF unavailable: %s", ex.what());
        return;
      }

      pose.x = tf.transform.translation.x;
      pose.y = tf.transform.translation.y;

      tf2::Quaternion q(
          tf.transform.rotation.x,
          tf.transform.rotation.y,
          tf.transform.rotation.z,
          tf.transform.rotation.w);

      pose.theta = tf2::getYaw(q);
      twist = geometry_msgs::msg::Twist{};
    }

    pose_pub_->publish(pose);
    vel_pub_->publish(twist);

    global_interfaces::msg::RobotState state_msg;
    state_msg.x = pose.x;
    state_msg.y = pose.y;
    state_msg.theta = pose.theta;
    state_msg.vx = twist.linear.x;
    state_msg.vy = twist.linear.y;
    state_msg.omega = twist.angular.z;

    state_pub_->publish(state_msg);

  }
};

int main(int argc, char **argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<RobotStateNode>());
  rclcpp::shutdown();
  return 0;
}
