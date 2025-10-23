cmake_minimum_required(VERSION 3.8)
project(cam_min)

if(NOT CMAKE_CXX_STANDARD)
  set(CMAKE_CXX_STANDARD 17)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(OpenCV REQUIRED)

add_executable(camera_publisher src/camera_publisher.cpp)
ament_target_dependencies(camera_publisher rclcpp sensor_msgs)
target_include_directories(camera_publisher PUBLIC ${OpenCV_INCLUDE_DIRS})
target_link_libraries(camera_publisher ${OpenCV_LIBRARIES})

install(TARGETS camera_publisher
  DESTINATION lib/${PROJECT_NAME})

install(FILES resource/cam_min
  DESTINATION share/ament_index/resource_index/packages)

install(FILES package.xml
  DESTINATION share/${PROJECT_NAME})

ament_package()
