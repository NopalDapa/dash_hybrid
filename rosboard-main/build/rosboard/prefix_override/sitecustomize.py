import sys
if sys.prefix == '/usr':
    sys.real_prefix = sys.prefix
    sys.prefix = sys.exec_prefix = '/home/nopal/dash_hybrid (1)/rosboard-main/install/rosboard'
