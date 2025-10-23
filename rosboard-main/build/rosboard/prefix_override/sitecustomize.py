import sys
if sys.prefix == '/usr':
    sys.real_prefix = sys.prefix
    sys.prefix = sys.exec_prefix = '/home/nopal/dash_hybrid/rosboard-main/install/rosboard'
