/** Startup tutorial copy from Tutorial.vue. Keys are whitespace-normalized English. */
export const tutorialDictionary: Record<string, string> = {
  'Welcome to Cockpit!': '欢迎使用 Cockpit！',
  'Thank you for trying our control station software - we hope you make it your own!':
    '感谢试用我们的地面站软件，希望你能把它变成自己的工作台！',
  'This guide will assist you in connecting to your vehicle, and walk you through the available menu pages.':
    '本指南将帮助你连接载具，并带你了解各个菜单页面。',
  'Main Menu': '主菜单',
  "Cockpit's configuration options and tools are accessed through its sidebar.": 'Cockpit 的配置选项和工具通过侧边栏进入。',
  'Open it by clicking the highlighted tab on the left side of the screen.': '点击屏幕左侧高亮的标签即可打开。',
  'Connections and Behaviour': '连接与行为',
  "The 'Settings' menu allows configuring Cockpit's connections and behavior.":
    '「设置」菜单用于配置 Cockpit 的连接和行为。',
  'General Configuration': '常规配置',
  "The 'General' page allows switching the active user, the vehicle connection settings, and what Cockpit shares with the development team.":
    '「常规」页面可切换当前用户、载具连接设置，以及 Cockpit 与开发团队共享的内容。',
  'Each user can have their own settings, interface profiles, and joystick mappings, which can be stored on and synchronized through the connected vehicle.':
    '每位用户可以拥有自己的设置、界面配置方案和摇杆映射，并可存储在已连接的载具上同步。',
  'Vehicle Address': '载具地址',
  "Cockpit connects to a vehicle's network using a global address.": 'Cockpit 通过全局地址连接到载具网络。',
  'This is usually found automatically, but if necessary you can specify a custom domain to connect to and search for the relevant vehicle components.':
    '通常会自动发现；如有需要，也可以指定自定义域名来连接并搜索相关载具组件。',
  'Interface Configuration': '界面配置',
  "Here, you'll find options to control the interface style, move the sidebar access point, and switch the display units between imperial and metric, for widgets that support it.":
    '这里可以调整界面样式、移动侧边栏入口位置，并在支持的组件上将显示单位在英制与公制之间切换。',
  'Joystick Configuration': '摇杆配置',
  'Connect a controller and move a joystick or press a button to see the current function mapping.':
    '连接手柄后移动摇杆或按下按钮，即可查看当前功能映射。',
  ["Fully supported joysticks have a visual configuration interface available, but there's also a " +
    'mapping table provided for custom or uncommon controllers. Actions can be related to vehicle functions, ' +
    'can influence the display, or can run custom requests or code.']:
    '受完整支持的摇杆提供可视化配置界面，自定义或不常见的手柄也可使用映射表。动作可以对应载具功能、影响显示，或运行自定义请求与代码。',
  'Video Configuration': '视频配置',
  "Video sources (from MAVLink Camera Manager / BlueOS) can be given custom names, and you can configure Cockpit's receiver settings to improve performance.":
    '视频源（来自 MAVLink Camera Manager / BlueOS）可以自定义名称，也可以调整 Cockpit 的接收设置以提升性能。',
  ['There are also preferences for the video recording library, to automatically process recorded chunks ' +
    'into video files, and zip together files when downloading multiple videos or a video with telemetry subtitles.']:
    '录像库还可以设置自动将分块合成为视频文件，并在下载多个视频或带遥测字幕的视频时打包成 zip。',
  'Telemetry Recording': '遥测录制',
  ['Subtitle overlays of telemetry data can be recorded with videos. This panel allows choosing which ' +
    'variables to include, where they appear on the screen, how the subtitles are styled, and the update rate.']:
    '遥测数据可以以字幕叠加的方式与视频一同录制。此面板可选择包含哪些变量、它们在画面中的位置、字幕样式以及更新频率。',
  'Alerts Configuration': '告警配置',
  'Voice alerts can announce notifications and issues during operation, without covering the screen. The voice and reported alert severities can be configured here.':
    '语音告警可在操作过程中播报通知和问题，而无需遮挡画面。可在此配置语音以及播报的告警级别。',
  'Dev Settings': '开发设置',
  'This section includes settings and Cockpit logs to help with development and advanced troubleshooting.':
    '此部分包含用于开发和深度排查的设置与 Cockpit 日志。',
  ['We recommend leaving the default values, but if you prefer to you can stop Cockpit from synchronizing ' +
    "its settings with BlueOS vehicles. Telemetry sharing is configured from 'Settings' > 'General' > 'Shared Data'."]:
    '建议保持默认值；如有需要，也可以停止 Cockpit 与 BlueOS 载具同步设置。遥测共享在「设置」>「常规」>「共享数据」中配置。',
  'Mission Configuration': '任务配置',
  'This panel allows selecting which vehicle commands require an extra confirmation step before sending, to avoid triggering mission- or safety-critical functions accidentally.':
    '此面板可选择哪些载具指令在发送前需要额外确认，以免误触发任务或安全相关功能。',
  'Tutorial Completed': '教程完成',
  "You're ready to go!": '可以开始使用了！',
  ["If you want to see it again, this guide can be reopened through 'Settings' > 'General'. " +
    "For further support, please reach out through the channels listed in the 'About' section of the sidebar."]:
    '如需再次查看，可在「设置」>「常规」中重新打开本指南。更多支持请通过侧边栏「关于」中列出的渠道联系。',
  'This guide can be reopened via the Settings > General menu': '可在「设置」>「常规」中重新打开本指南',
}
