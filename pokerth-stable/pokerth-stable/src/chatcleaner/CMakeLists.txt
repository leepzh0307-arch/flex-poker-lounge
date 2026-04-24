# POKERTH.chatcleaner

set(POKERTH_CHATCLEANER_SRC chatcleaner.cpp
	cleanerserver.cpp
	messagefilter.cpp
	badwordcheck.cpp
	textfloodcheck.cpp
	cleanerconfig.cpp
	capsfloodcheck.cpp
	letterrepeatingcheck.cpp
	urlcheck.cpp)

add_executable(pokerth_chatcleaner "${POKERTH_CHATCLEANER_SRC}" )

target_include_directories(pokerth_chatcleaner PUBLIC
    ../net/)

target_link_libraries(pokerth_chatcleaner PUBLIC pokerth_lib)
target_link_libraries(pokerth_chatcleaner PUBLIC pokerth_protocol)
target_link_libraries(pokerth_chatcleaner PUBLIC "${Protobuf_LIBRARIES}")
target_link_libraries(pokerth_chatcleaner PRIVATE Qt6::Xml Qt6::Network)

install(TARGETS pokerth_chatcleaner DESTINATION bin OPTIONAL COMPONENT pokerth_chatcleaner)
