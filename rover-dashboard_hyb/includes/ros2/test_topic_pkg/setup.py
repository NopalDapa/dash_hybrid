from setuptools import setup

package_name = 'test_topic_pkg'

setup(
    name=package_name,
    version='0.0.1',
    packages=[package_name],
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='rover-dashboard',
    maintainer_email='nopal@example.com',
    description='Publishes an initial test value and listens for updates from the rover dashboard.',
    license='MIT',
    entry_points={
        'console_scripts': [
            'test_node = test_topic_pkg.test_node:main',
        ],
    },
)
