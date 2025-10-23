from typing import Optional

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile
from std_msgs.msg import Int32


class TestTopicBridge(Node):
    """Publishes a test integer on /test and mirrors dashboard updates."""

    def __init__(self) -> None:
        super().__init__('test_topic_bridge')

        self.declare_parameter('topic_name', 'test')
        self.declare_parameter('initial_value', 5)
        self.declare_parameter('publish_period_seconds', 1.0)

        configured_topic = self.get_parameter('topic_name').value
        if not isinstance(configured_topic, str) or not configured_topic:
            configured_topic = 'test'
        if not configured_topic.startswith('/'):
            configured_topic = f'/{configured_topic}'
        self._topic_name = configured_topic

        self._current_value: int = int(self.get_parameter('initial_value').value)
        self._last_published: Optional[int] = None
        self._publish_period = float(self.get_parameter('publish_period_seconds').value)
        if self._publish_period <= 0.0:
            self._publish_period = 1.0

        qos_profile = QoSProfile(depth=10)

        self._publisher = self.create_publisher(Int32, self._topic_name, qos_profile)
        self._subscription = self.create_subscription(Int32, self._topic_name, self._handle_test_message, qos_profile)
        self._publish_timer = self.create_timer(self._publish_period, self._publish_current_value)

        self.get_logger().info(
            f"test_topic_bridge ready. Publishing to {self._topic_name} with initial value {self._current_value}"
        )
        self._publish_current_value()

    def _publish_current_value(self) -> None:
        msg = Int32()
        msg.data = int(self._current_value)
        self._publisher.publish(msg)

        if self._last_published != msg.data:
            self._last_published = msg.data
            self.get_logger().info(
                f"Published value {msg.data} on {self._topic_name}"
            )

    def _handle_test_message(self, msg: Int32) -> None:
        incoming_value = int(msg.data)
        if incoming_value != self._current_value:
            self.get_logger().info(
                f"Received update on {self._topic_name}: {incoming_value}"
            )
        self._current_value = incoming_value


def main() -> None:
    rclpy.init()
    node = TestTopicBridge()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
