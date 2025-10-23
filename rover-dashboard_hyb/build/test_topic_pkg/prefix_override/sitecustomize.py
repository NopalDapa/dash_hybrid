import sys
if sys.prefix == '/usr':
    sys.real_prefix = sys.prefix
    sys.prefix = sys.exec_prefix = '/home/nopal/dash_hybrid/rover-dashboard/install/test_topic_pkg'
