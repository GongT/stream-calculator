使用MATLAB写一个使用tcp的完整例子：
1. 封装成类型，使用连接目标和数据回调构造
1. 回调参数为 this, action, payload
1. 仅实现tcp客户端(connect)
1. 实现一个简单协议: "START"+packet_length+action+payload+"END"，length、action为uint32，所有数据以大端表示。
1. payload 同时支持 uint32、int32、double 三种数据类型中的一种作为元素，但同一个app中只可能使用其中一种，另外两种应通过某种简单修改进行切换。如果传入了不符的数据，应该报错（任何时候不要进行隐式类型转换）
1. 封装一个方法(emit)用于数据产生时调用：将参数传入的action+payload通过此协议发送出去。
1. 写一个简单的测试，把收到的数据前后颠倒再发回。其中链接目标: 默认为 127.0.0.1、9000、环境变量 HOST & PORT、如果编译成exe，则检查命令行输入（--host、--port）
1. 用python实现一个调试用的最小服务器：链接后每5秒向其中写入10个随机数
1. 写注释用中文
