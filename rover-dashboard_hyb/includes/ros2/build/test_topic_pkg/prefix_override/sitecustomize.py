import sys
if sys.prefix == '/usr':
    sys.real_prefix = sys.prefix
    sys.prefix = sys.exec_prefix = '/home/nopal/rover-dashboard/ros2/install/test_topic_pkg'
