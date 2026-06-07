# Robophone LLM Manual – Enhanced Complete Block Guide

This file is designed to help an LLM choose correct RoboPhone/Blockly blocks and produce step-by-step instructions for a beginner user.

## Required Answer Style for LLMs

When answering user requests based on this manual:
- Output only the ordered list of steps/commands needed to build the program.
- Name the category/group first, then the exact block to drag.
- Explain where to place the block: inside `on start`, inside a loop `do` area, inside an `if` branch, or inside a value socket.
- Use only blocks described in this manual unless the user provides a screenshot or additional source.
- Prefer exact block names and exact field values.
- For 12-year-old/beginner guidance, include drag/click instructions and where each block connects.

---

# Foundations and Navigation

## What RoboPhone Is

RoboPhone is a visual programming environment used in Robophysics to build executable experiments and interactive systems using predefined blocks. The blocks represent actions, calculations, sensors, displays, media, communication, files, robot control, and reusable routines.

LLM selection rule: think like a human Blockly user. Choose the block category first, then the specific block.

## Flowchart Meaning

### Start / End
Use for the beginning or ending boundary of a program.

### Data Processing / Process
Use for calculations, variable updates, lists, arrays, expressions, or transformations.

### Decision
Use for `if`, `if/else`, comparisons, boolean checks, and wait-until conditions.

### Data Transfer / Input-Output
Use for inputs, sensor readings, display outputs, files, database, SMS, speech, and graph output.

## Category-First Selection Heuristic

1. Identify task family:
   - flow, logic, math, text, display, media, sensor, data/file/database, robot, macro/custom block.
2. Identify action role:
   - get input, process data, make a decision, show output, store/send data.
3. Choose exact block.
4. Check data types:
   - numeric, string, boolean, list, statement, value block.
5. Check placement:
   - root container, statement chain, loop body, if branch, or value socket.

## Universal Block Documentation Format

Each block entry uses this pattern:

```yaml
block_id: stable identifier
block_name: visible Blockly name
category: grouping element/menu to click
msg_key: null  # no mapping defined
html_category: null
html_label: null
type: statement | value | container | root | bool | multi-output
visual_signature: what the block looks like in screenshots
function:
  summary: what it does
  use_when: when to choose this block
  avoid_when: nearby blocks that are better for other tasks
inputs: exact sockets/fields
outputs: returned value, if any
instruction_template: beginner UI steps
example_task: canonical use
```

## Important Graphing Rules

- Use `Graph Draw Point` inside a loop to draw functions point-by-point.
- Use `Reset Graph` before the loop to prevent graph accumulation between runs.
- Leave the `clear?` checkbox unchecked while drawing a curve; otherwise each new point may erase previous points.
- Trigonometric block input is in degrees.
- When the user asks for the x-axis in radians, loop over degrees for trig calculation and convert degrees to radians for graph X using `math_expression`:
  - `xRad = x*3.1416/180` with `x = angleDeg`.

## Common Recipes

```md
When a machine recipe exists, prefer it over the beginner/human recipe when generating 'execute_blockly_script' commands.

### Plot sin/cos with radians on x-axis

```yaml
recipe_id: plot_trig_radian_x_axis
steps:
  - Start Program / on start
  - Reset Graph red and blue before plotting
  - Repeat and Increment angleDeg from -360 to 360 by 90 for -2pi..2pi in 0.5pi steps
  - Set xRad using math_expression: "x*3.1416/180", x=angleDeg
  - Set ySin using trig_function sin(angleDeg)
  - Draw Graph Point x=xRad y=ySin color=red clear=false
  - Set yCos using trig_function cos(angleDeg)
  - Draw Graph Point x=xRad y=yCos color=blue clear=false
```

## Common Recipes

### Plot sin/cos with radians on x-axis

```yaml
recipe_id: plot_trig_radian_x_axis
steps:
  - Start Program / on start
  - Reset Graph red and blue before plotting
  - Repeat and Increment angleDeg from -360 to 360 by 90 for -2pi..2pi in 0.5pi steps
  - Set xRad using math_expression: "x*3.1416/180", x=angleDeg
  - Set ySin using trig_function sin(angleDeg)
  - Draw Graph Point x=xRad y=ySin color=red clear=false
  - Set yCos using trig_function cos(angleDeg)
  - Draw Graph Point x=xRad y=yCos color=blue clear=false
```

### Plot sin with radians on x-axis

```yaml
recipe_id: machine_recipe_plot_sin_radian_x_axis
purpose: Generate execute_blockly_script commands for drawing y = sin(x) with graph x-axis from -2pi to +2pi.
important_notes:
  - execute_blockly_script uses positional nested sockets, not named sockets.
  - GRAPH first nested value child fills x.
  - GRAPH second nested value child fills y.
  - MATH_ADVANCED nested value sockets are positional.
  - To avoid accidentally filling the wrong MATH_ADVANCED socket, use parameter a for the angle.
  - Use expression_string "a*3.1416/180", not "x*3.1416/180", unless a/b/c are also filled before x.
  - MATH_TRIG sin input must receive degrees, not radians.
  - clear must be false while drawing a curve.
steps:
  - spawn INITIATE id=start cat=["CATLOOPS"]
  - spawn RESET_GRAPH id=reset parent=start pos=nested cat=["CATSMARTPHONE","CATVIRTUALACTION"]
  - input reset "red"
  - spawn CONTROLS_FOR id=loop parent=reset pos=next cat=["CATLOOPS"]
  - input loop "angleDeg"
  - input loop "-360"
  - input loop "360"
  - input loop "10"
  - spawn GRAPH id=draw parent=loop pos=nested cat=["CATSMARTPHONE","CATVIRTUALACTION"]
  - spawn MATH_ADVANCED id=xrad_calc parent=draw pos=nested cat=["CATMATH"]
  - input xrad_calc "a*3.1416/180"
  - spawn VAR_GET id=get_angle parent=xrad_calc pos=nested cat=["Variables"]
  - input get_angle "angleDeg"
  - spawn MATH_TRIG id=ysin_calc parent=draw pos=nested cat=["CATMATH"]
  - input ysin_calc "sin"
  - spawn VAR_GET id=get_angle2 parent=ysin_calc pos=nested cat=["Variables"]
  - input get_angle2 "angleDeg"
  - input draw "red"
  - input draw "false"
```

### Clear graph before rerun

```yaml
recipe_id: clear_graph_before_rerun
steps:
  - Place Reset Graph color blocks before any loop that draws points
  - Reset each color that will be reused
  - Do not rely on Graph Draw Point to clear old runs
```

---

# Virtual Display

Use for anything the user wants to show visually: LCD text, graph points, LED status, bars, saved/loaded graphs.

## LCD Grid

```yaml
block_id: lcd_grid
block_name: LCD Grid
category: virtual_display
msg_key: LCD_TEXT
html_category: Virtual Display
html_label: "lcd grid write"
html_match_fragments: ["lcd grid write"]
type: statement
visual_signature: light blue rectangular LCD block; contains text similar to 'lcd grid write'; has text, line, offset, color, size inputs
function:
  summary: Displays short text at an exact row/column on the 4x20 LCD display.
  use_when:
    - display short text
    - place text at a specific line/offset
    - label a graph or screen component
  avoid_when:
    - long multi-line messages → use lcd_message
    - graphing values → use graph_draw_point
inputs:
  - text: string
  - line: number 0-3
  - left_offset: number 0-19
  - color: red/yellow/green/blue
  - size: small/large
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag LCD Grid / lcd grid write into the program
  - Put the text in the text socket
  - Set line, offset, color, and size
example_task: Display label 'sin' at line 0 offset 0 in red.
```

## LCD Message

```yaml
block_id: lcd_message
block_name: LCD Message
category: virtual_display
msg_key: LCD_MESSAGE
html_category: Virtual Display
html_label: "lcd msg write"
html_match_fragments: ["lcd msg write"]
type: statement
visual_signature: light blue LCD message block; no row/column sockets; used for larger text areas
function:
  summary: Displays a larger text message without choosing exact row/column.
  use_when:
    - display long text
    - show explanations
    - show status messages
  avoid_when:
    - precise row/offset placement → use lcd_grid
inputs:
  - text: string
  - color: red/yellow/green/blue
  - size: small/large
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag LCD Message
  - Put the message text into the text input
  - Choose color/size if available
example_task: Display 'Program complete'.
```

## Graph Draw Point

```yaml
block_id: graph_draw_point
block_name: Graph Draw Point
category: virtual_display
msg_key: GRAPH
html_category: Virtual Display
html_label: "draw graph point ("
html_match_fragments: ["draw graph point ("]
type: statement
visual_signature: light blue graph block; contains 'draw graph point ( x , y ) with color ... clear?'
function:
  summary: Draws one (x,y) point on the graph display. Repeating it in a loop creates a curve.
  use_when:
    - plot functions
    - plot sensor data
    - draw multiple colored graph series
  avoid_when:
    - automatic sensor acquisition over time → use graph_draw_on
inputs:
  - x: number
  - y: number
  - point_color: red/yellow/green/blue
  - clear_graph_after_point: boolean checkbox
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag Draw Graph Point into the loop
  - Set X value
  - Set Y value
  - Choose graph color
  - Leave clear unchecked when drawing many points
example_task: Inside a loop, draw graph point x=xRad, y=ySin, color=red.
important_note: use inside a loop; keep clear? unchecked while drawing a curve
```

## 8LED

```yaml
block_id: led_8bit
block_name: 8LED
category: virtual_display
msg_key: LED
html_category: Virtual Display
html_label: "set led + to"
html_match_fragments: ["set led", "to"]
type: statement
visual_signature: light blue rectangular display block; contains '8LED' and a row of 8 small lights
function:
  summary: Displays a number 0-255 as an 8-bit LED pattern.
  use_when:
    - visualize binary/bit state
    - debug decimal-to-binary outputs
    - show switch-like status
  avoid_when:
    - text → use LCD blocks
    - continuous values → use line_bar
inputs:
  - value: number 0-255
  - color: red/yellow/green/blue
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag 8LED
  - Put numeric value into value input
  - Choose LED color
example_task: Show value 13 as LEDs.
```

## Line Bar

```yaml
block_id: line_bar
block_name: Line Bar
category: virtual_display
msg_key: BAR
html_category: Virtual Display
html_label: "set line bar"
html_match_fragments: ["set line bar"]
type: statement
visual_signature: light blue horizontal bar block; looks like a potentiometer/slider bar
function:
  summary: Displays a continuous numeric value as a horizontal bar.
  use_when:
    - show normalized value
    - show potentiometer value
    - show approximate strength/level
  avoid_when:
    - exact number display → use LCD or 7Segment
    - graph over time → use graph_draw_point
inputs:
  - value: number, usually -100 to 100
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag Line Bar
  - Connect numeric value
example_task: Display potentiometer value as a bar.
```

## 3x7Segment

```yaml
block_id: segment_3x7
block_name: 3x7Segment
category: virtual_display
msg_key: SSEGMENT
html_category: Virtual Display
html_label: "all + 7segment"
html_match_fragments: ["all", "7segment"]
type: statement
visual_signature: light blue segmented digit block; contains '7SEG' or segmented digits
function:
  summary: Displays numeric/segment-based values in a seven-segment style.
  use_when:
    - show numeric hardware-style output
    - show digit segments
  avoid_when:
    - free text → use LCD
    - binary LEDs → use 8LED
inputs:
  - mode: numeric/msb/middle/lsb
  - value/segment input when available
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag 3x7Segment
  - Choose mode
  - Connect number/segment value
example_task: Display number 7.
```

## Graph Draw On

```yaml
block_id: graph_draw_on
block_name: Graph Draw On
category: virtual_display
msg_key: GRAPH_DA
html_category: Virtual Display
html_label: "draw graph"
html_match_fragments: ["draw graph"]
type: statement
visual_signature: light blue graph timeline block; contains graph/timeline icon and source/rate/duration fields
function:
  summary: Automatically samples selected robot/smartphone sensors and plots them over time.
  use_when:
    - continuous data acquisition
    - sensor graphing without manual loop
    - real-time plotting
  avoid_when:
    - manual function plotting → use graph_draw_point
inputs:
  - duration: seconds
  - rate: Hz
  - source: robot/smartphone
  - sensors: selected sensors
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag Graph Draw On
  - Set duration
  - Set rate
  - Choose source and sensors
example_task: Record smartphone angle for 10 seconds at 50 Hz.
```

## Draw Trendline

```yaml
block_id: graph_trendline
block_name: Draw Trendline
category: virtual_display
msg_key: GET_GRAPH_TRENDLINE
html_category: Virtual Display
html_label: "trendline graph"
html_match_fragments: ["trendline graph"]
type: statement/value-output
visual_signature: light blue graph/regression block; contains trendline/regression text
function:
  summary: Computes a regression/trendline from existing graph data and outputs coefficients.
  use_when:
    - fit a line/function to graph data
    - get slope/intercept
    - compute model after plotting
  avoid_when:
    - drawing raw points → use graph_draw_point
inputs:
  - function_type: enum
  - timeframe: number
  - graph_color: color
outputs: coefficients, such as slope/intercept depending on fit
instruction_template:
  - Go to Virtual Display
  - Drag Draw Trendline
  - Choose function type
  - Choose graph color
  - Set timeframe
  - Use coefficient outputs if needed
example_task: Fit a line to red graph and display slope.
```

## Save Graph

```yaml
block_id: graph_save
block_name: Save Graph
category: virtual_display
msg_key: GRAPH_SAVE
html_category: Virtual Display
html_label: "save graphs"
html_match_fragments: ["save graphs"]
type: statement/value-output
visual_signature: light blue save graph block; graph icon with file/save concept
function:
  summary: Saves a selected graph color to a CSV file.
  use_when:
    - export graph data
    - save experiment results
    - produce CSV
  avoid_when:
    - saving arbitrary text → use write_line_file
inputs:
  - graph_color: red/yellow/green/blue
outputs: filename
instruction_template:
  - Go to Virtual Display
  - Drag Save Graph
  - Choose graph color
  - Store/use returned filename if needed
example_task: Save the red graph to CSV.
```

## Load Graph

```yaml
block_id: graph_load
block_name: Load Graph
category: virtual_display
msg_key: GRAPH_FILE
html_category: Virtual Display
html_label: "draw graph from"
html_match_fragments: ["draw graph from"]
type: statement
visual_signature: light blue load graph block; graph icon with file/load concept
function:
  summary: Loads graph data from a CSV file and draws it on the graph display.
  use_when:
    - restore saved graph
    - show previous data
  avoid_when:
    - real-time acquisition → use graph_draw_on
inputs:
  - file: string or filename variable
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag Load Graph
  - Put CSV filename into file input
example_task: Load file 'trial1.csv'.
```

## Reset Graph

```yaml
block_id: graph_reset
block_name: Reset Graph
category: virtual_display
msg_key: RESET_GRAPH
html_category: Virtual Display
html_label: "reset graph color"
html_match_fragments: ["reset graph color"]
type: statement
visual_signature: light blue graph block; contains 'reset graph color' and a color selector
function:
  summary: Clears/removes graph data of one selected color from the display.
  use_when:
    - clear old graph before new run
    - avoid accumulating repeated runs
    - clear one series only
  avoid_when:
    - clear all UI components → use component_toggle if hiding components
inputs:
  - graph_color: red/yellow/green/blue
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag Reset Graph
  - Choose color
  - Place before the plotting loop
example_task: Reset red and blue graphs before drawing sin/cos.
important_note: place before plotting loop to clear old runs; one reset block per graph color
```

## Load/Unload Component

```yaml
block_id: component_toggle
block_name: Load/Unload Component
category: virtual_display
msg_key: SHOW_COMPONENT
html_category: Virtual Display
html_label: "load component"
html_match_fragments: ["load component"]
type: statement
visual_signature: light blue component block; load/unload screen component selector
function:
  summary: Shows or hides selected display/screen components.
  use_when:
    - remove a component from screen
    - show a component only when needed
  avoid_when:
    - clear graph data → use graph_reset
inputs:
  - component: selected screen component
  - mode: load/unload if available
outputs: none
instruction_template:
  - Go to Virtual Display
  - Drag Load/Unload Component
  - Choose component
  - Choose load or unload
example_task: Hide the graph display after the run.
```

# Physical Sensors

Use for phone/device physical measurements such as angle, gyro, acceleration, GPS.

## Angle (scalar)

```yaml
block_id: angle_scalar
block_name: Angle (scalar)
category: physical_sensors
msg_key: SENSOR_MEASURE
html_category: Physical Sensors
html_label: "angle Scalar"
html_match_fragments: ["angle Scalar"]
type: value
visual_signature: pink sensor block; contains 'angle'; no inputs
function:
  summary: Returns device rotation angle in degrees.
  use_when:
    - use phone angle as numeric input
    - graph orientation
    - trigger actions by rotation
  avoid_when:
    - robot motor angle → use robot sensor read
inputs:
  - none
outputs: number in degrees
instruction_template:
  - Go to Physical Sensors
  - Drag Angle (scalar) into a numeric input socket
example_task: Plot phone angle over time.
```

## Gyro Rate

```yaml
block_id: gyro_rate
block_name: Gyro Rate
category: physical_sensors
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value
visual_signature: pink gyro/rate block; no inputs
function:
  summary: Returns angular velocity in degrees per second.
  use_when:
    - measure rotation speed
    - graph angular velocity
  avoid_when:
    - angle position → use angle_scalar
inputs:
  - none
outputs: number deg/sec
instruction_template:
  - Go to Physical Sensors
  - Drag Gyro Rate into numeric socket
example_task: Show gyro rate on LCD.
```

## Linear Acceleration

```yaml
block_id: acceleration
block_name: Linear Acceleration
category: physical_sensors
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value
visual_signature: pink acceleration block with x/y/z axis selector
function:
  summary: Returns linear acceleration along selected axis.
  use_when:
    - measure phone acceleration
    - motion experiments
    - data acquisition
  avoid_when:
    - robot acceleration command → use motion_accelerated
inputs:
  - axis: x/y/z
outputs: number
instruction_template:
  - Go to Physical Sensors
  - Drag Linear Acceleration
  - Choose axis
  - Connect output to graph/math/display
example_task: Graph x-axis acceleration.
```

## GPS

```yaml
block_id: gps
block_name: GPS
category: physical_sensors
msg_key: SENSOR_MEASURE
html_category: Physical Sensors
html_label: "angle Scalar"
html_match_fragments: ["angle Scalar"]
type: value/multi-output
visual_signature: pink GPS/location block; outputs latitude/longitude/altitude/distance
function:
  summary: Returns location-related GPS values.
  use_when:
    - track position
    - measure distance
    - record GPS data
  avoid_when:
    - screen joystick coordinates → use joystick
inputs:
  - selected output: longitude/latitude/altitude/distance
outputs: number or multi-value
instruction_template:
  - Go to Physical Sensors
  - Drag GPS
  - Choose needed output
  - Connect to display/data block
example_task: Display GPS distance.
```

# Virtual Sensors

Use for screen/user-controlled input: keypad, keyboard, joystick, potentiometer, button.

## Keypad Numeric

```yaml
block_id: keypad_numeric
block_name: Keypad Numeric
category: virtual_sensors
msg_key: VIRTUAL_SENSOR_MEASURE
html_category: Virtual Sensors
html_label: "switches"
html_match_fragments: ["switches"]
type: value
visual_signature: blue keypad block; numeric keypad icon; waits for entered number
function:
  summary: Gets numeric input from the user.
  use_when:
    - ask user for a number
    - set variable from keypad
    - parameter input
  avoid_when:
    - text input → use keyboard_text
inputs:
  - none
outputs: number
instruction_template:
  - Go to Virtual Sensors
  - Drag Keypad Numeric into a value socket
  - Use output to set a variable
example_task: Ask user for loop max.
```

## Button

```yaml
block_id: button
block_name: Button
category: virtual_sensors
msg_key: KEY1_BUTTON
html_category: Virtual Sensors
html_label: "set trigger button message"
html_match_fragments: ["set trigger button message"]
type: statement
visual_signature: blue button block; has message text input
function:
  summary: Shows a button and waits for user interaction.
  use_when:
    - pause until user presses button
    - manual start/confirm step
  avoid_when:
    - boolean switch value → use switch/toggle if available
inputs:
  - message: string
outputs: none
instruction_template:
  - Go to Virtual Sensors
  - Drag Button
  - Set button message
example_task: Wait for user to press 'Start'.
```

## Keyboard Alpha Numeric

```yaml
block_id: keyboard_text
block_name: Keyboard Alpha Numeric
category: virtual_sensors
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value
visual_signature: blue keyboard block; returns typed text
function:
  summary: Gets alpha-numeric text input from the user.
  use_when:
    - ask for name
    - ask for filename
    - ask for message
  avoid_when:
    - numbers only → use keypad_numeric
inputs:
  - none
outputs: string
instruction_template:
  - Go to Virtual Sensors
  - Drag Keyboard Alpha Numeric into a string input/socket
example_task: Ask user for file name.
```

## Joystick

```yaml
block_id: joystick
block_name: Joystick
category: virtual_sensors
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value/multi-output
visual_signature: blue joystick block; outputs x and y coordinates
function:
  summary: Returns x/y coordinates from on-screen joystick.
  use_when:
    - control robot direction
    - manual input with two axes
    - screen-based coordinate input
  avoid_when:
    - GPS coordinates → use gps
inputs:
  - none
outputs: x number, y number
instruction_template:
  - Go to Virtual Sensors
  - Drag Joystick
  - Use x and/or y output
example_task: Use joystick x for steering.
```

## Potentiometers

```yaml
block_id: potentiometer
block_name: Potentiometers
category: virtual_sensors
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value
visual_signature: blue potentiometer block; color/index selector; output range usually -100 to 100
function:
  summary: Returns analog value from on-screen potentiometer.
  use_when:
    - manual continuous input
    - control speed/volume/threshold
    - adjust a parameter live
  avoid_when:
    - display bar → use line_bar
inputs:
  - index/color: selected potentiometer
outputs: number, usually -100 to 100
instruction_template:
  - Go to Virtual Sensors
  - Drag Potentiometers
  - Choose index/color
  - Connect output
example_task: Use potentiometer as motor power.
```

# Advanced Sensors

Use for interpreted sensing: color, light, sound, proximity/touch, face recognition/position.

## Color Ambient Light

```yaml
block_id: color_ambient
block_name: Color Ambient Light
category: advanced_sensors
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value
visual_signature: brown/light sensor block; contains light/ambient wording
function:
  summary: Measures ambient light intensity normalized from 0 to 100%.
  use_when:
    - measure brightness
    - trigger by room light
    - graph light level
  avoid_when:
    - detect a specific color → use color_detect
inputs:
  - none
outputs: number 0-100
instruction_template:
  - Go to Advanced Sensors
  - Drag Color Ambient Light
  - Connect to numeric input
example_task: Graph ambient light.
```

## Color Detect

```yaml
block_id: color_detect
block_name: Color Detect
category: advanced_sensors
msg_key: ADVANCED_SENSORS_MEASURE
html_category: Advanced Sensors
html_label: "color Detect"
html_match_fragments: ["color Detect"]
type: value
visual_signature: brown camera/color block; contains color/detect wording
function:
  summary: Detects one predefined color and returns numeric color code.
  use_when:
    - detect visible color
    - condition based on camera color
  avoid_when:
    - light level → use color_ambient
inputs:
  - none
outputs: number 0-7: 0 none, 1 black, 2 blue, 3 green, 4 yellow, 5 red, 6 white, 7 brown
instruction_template:
  - Go to Advanced Sensors
  - Drag Color Detect
  - Compare returned number to color code
example_task: If detected color is red, play sound.
```

## Sound Amplitude

```yaml
block_id: sound_amplitude
block_name: Sound Amplitude
category: advanced_sensors
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value
visual_signature: brown sound block; microphone/sound icon
function:
  summary: Measures sound amplitude normalized from 0 to 100%.
  use_when:
    - detect loudness
    - trigger action by clap/noise
    - graph sound level
  avoid_when:
    - record audio file → use Advanced Media Audio Record
inputs:
  - none
outputs: number 0-100
instruction_template:
  - Go to Advanced Sensors
  - Drag Sound Amplitude
  - Connect to comparison/graph/display
example_task: If sound > 80, write Loud.
```

## Touch Sensor

```yaml
block_id: touch_sensor
block_name: Touch Sensor
category: advanced_sensors
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value/bool
visual_signature: brown proximity/touch block; returns true/false
function:
  summary: Returns true when proximity/touch threshold is met.
  use_when:
    - detect hand/near object
    - conditional trigger
    - wait until touched
  avoid_when:
    - screen button → use button
inputs:
  - none
outputs: boolean
instruction_template:
  - Go to Advanced Sensors
  - Drag Touch Sensor into condition socket
example_task: Wait until touch sensor is true.
```

## Face Recognition

```yaml
block_id: face_recognition
block_name: Face Recognition
category: advanced_sensors
msg_key: FACES_NAME
html_category: Advanced Sensors
html_label: "nearest face name"
html_match_fragments: ["nearest face name"]
type: value
visual_signature: brown face block; includes person name input
function:
  summary: Identifies the closest recognized person by name.
  use_when:
    - recognize a stored face
    - branch based on identity
  avoid_when:
    - generic face position/distance → use face_position
inputs:
  - person_name: string
outputs: string recognized name
instruction_template:
  - Go to Advanced Sensors
  - Drag Face Recognition
  - Set person name if required
  - Use output in string comparison
example_task: If closest name is Dan, display Hello Dan.
```

## Get Position By Name

```yaml
block_id: face_position
block_name: Get Position By Name
category: advanced_sensors
msg_key: FACES_POSITION
html_category: Advanced Sensors
html_label: "get face"
html_match_fragments: ["get face"]
type: value/multi-output
visual_signature: brown face position block; outputs x/y/height/distance
function:
  summary: Returns position/distance data for a recognized face with a given name.
  use_when:
    - track known person's face
    - measure distance to face
    - use face x/y for control
  avoid_when:
    - only identify name → use face_recognition
inputs:
  - person_name: string
outputs: x, y, height_cm, distance_cm
instruction_template:
  - Go to Advanced Sensors
  - Drag Get Position By Name
  - Enter person name
  - Use needed output
example_task: Graph distance to Arnold's face.
```

# Communication

Use for speech, SMS, external AI/search questions.

## Text to Voice

```yaml
block_id: text_to_voice
block_name: Text to Voice
category: communication
msg_key: TEXTTOVOICE
html_category: Communication
html_label: "speak Text"
html_match_fragments: ["speak Text"]
type: statement
visual_signature: communication/media speech block; has text, volume, repeat flag
function:
  summary: Speaks text aloud.
  use_when:
    - read a value aloud
    - announce completion
    - voice feedback
  avoid_when:
    - play tone/music → use Advanced Media blocks
inputs:
  - text: string
  - volume: 0-100
  - repeat_flag: wait/play once/repeat
outputs: none
instruction_template:
  - Go to Communication
  - Drag Text to Voice
  - Connect text
  - Set volume and repeat flag
example_task: Speak 'done'.
```

## Voice to Text

```yaml
block_id: voice_to_text
block_name: Voice to Text
category: communication
msg_key: TELEPHONY_MEASURE
html_category: Communication
html_label: "voice To Text"
html_match_fragments: ["voice To Text"]
type: value
visual_signature: communication STT block; language selector and overwrite/edit flag
function:
  summary: Converts speech to text.
  use_when:
    - voice command input
    - dictate text
    - store spoken words
  avoid_when:
    - typed input → use keyboard_text
inputs:
  - language: hebrew/english/arabic
  - overwrite: true/false
outputs: string
instruction_template:
  - Go to Communication
  - Drag Voice to Text into string socket
  - Choose language
  - Choose overwrite flag
example_task: Set variable commandText to spoken English.
```

## Send SMS

```yaml
block_id: send_sms
block_name: Send SMS
category: communication
msg_key: SENDSMS
html_category: Communication
html_label: "send sms phone"
html_match_fragments: ["send sms phone"]
type: statement
visual_signature: communication SMS block; has phone number and content inputs
function:
  summary: Sends an SMS message.
  use_when:
    - text results to phone
    - send alert
    - share final list/value
  avoid_when:
    - display locally → use LCD
inputs:
  - phone_number: string in international format
  - content: string
outputs: none
instruction_template:
  - Go to Communication
  - Drag Send SMS
  - Enter phone number
  - Connect message content
example_task: Send result list to +972...
```

## Get SMS

```yaml
block_id: get_sms
block_name: Get SMS
category: communication
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value
visual_signature: communication read SMS block; no inputs
function:
  summary: Reads incoming SMS body text.
  use_when:
    - receive remote command
    - react to SMS
  avoid_when:
    - voice input → use voice_to_text
inputs:
  - none
outputs: string
instruction_template:
  - Go to Communication
  - Drag Get SMS into text/string socket
example_task: Display latest SMS on LCD.
```

## Ask Gemini or ChatGPT / Ask Google

```yaml
block_id: ask_llm
block_name: Ask Gemini or ChatGPT / Ask Google
category: communication
msg_key: GOOGLE
html_category: Communication
html_label: "Ask Google"
html_match_fragments: ["Ask Google"]
type: statement
visual_signature: communication AI/search block; text question input
function:
  summary: Sends a text prompt/question to an AI/search service.
  use_when:
    - ask external knowledge question
    - call Gemini/ChatGPT/Google
    - search for instructions
  avoid_when:
    - compute math locally → use Math blocks
inputs:
  - text: string prompt
outputs: none
instruction_template:
  - Go to Communication
  - Drag Ask Gemini/ChatGPT or Ask Google
  - Enter question text
example_task: Ask Google: 'how to make pancakes'.
```

# Data Operations

Use for local files, Firebase database, Firebase storage, upload/download/delete/wait.

## Write Line to File

```yaml
block_id: write_line_file
block_name: Write Line to File
category: data_operations
msg_key: WRITE_TO_FILE
html_category: Data Operations
html_label: "write Line"
html_match_fragments: ["write Line"]
type: statement
visual_signature: red file block; contains write line/file wording
function:
  summary: Writes one string line to a local file.
  use_when:
    - log data
    - save text
    - append experiment results
  avoid_when:
    - save graph as CSV → use graph_save
    - upload file → use upload_file
inputs:
  - file_name: string
  - text: string
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Write Line to File
  - Set file name
  - Connect text line
example_task: Write 'trial complete' to log.txt.
```

## Read Line from File

```yaml
block_id: read_line_file
block_name: Read Line from File
category: data_operations
msg_key: READ_FILE
html_category: Data Operations
html_label: "read Line from"
html_match_fragments: ["read Line from"]
type: value
visual_signature: red file read block; contains read line/file wording
function:
  summary: Reads one line of text from a local file.
  use_when:
    - reuse saved text
    - load parameter from file
  avoid_when:
    - load graph CSV visually → use graph_load
inputs:
  - file_name: string
outputs: string
instruction_template:
  - Go to Data Operations
  - Drag Read Line from File into text socket
  - Set file name
example_task: Read filename from config.txt.
```

## Delete File

```yaml
block_id: delete_file
block_name: Delete File
category: data_operations
msg_key: DELETE_FILE
html_category: Data Operations
html_label: "File + delete"
html_match_fragments: ["File", "delete"]
type: statement
visual_signature: red local file delete block; contains delete file wording
function:
  summary: Deletes a local file permanently.
  use_when:
    - remove created file
    - cleanup local storage
  avoid_when:
    - delete Firebase storage object → use storage_delete if available
inputs:
  - file_name: string
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Delete File
  - Set filename
example_task: Delete file named by variable s.
```

## Initialize DB

```yaml
block_id: firebase_init
block_name: Initialize DB
category: data_operations
msg_key: INIT_DB
html_category: Data Operations
html_label: "initialize firebase database at url"
html_match_fragments: ["initialize firebase database at url"]
type: statement
visual_signature: red Firebase block; initialize DB URL field
function:
  summary: Connects to a Firebase database URL.
  use_when:
    - use Firebase read/write/delete/wait blocks
    - start database workflow
  avoid_when:
    - file storage upload/download → use storage_init
inputs:
  - url: string
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Initialize DB
  - Paste database URL
  - Place before Firebase read/write blocks
example_task: Initialize database before writing key score.
```

## Write Key

```yaml
block_id: firebase_write
block_name: Write Key
category: data_operations
msg_key: WRITE_DB
html_category: Data Operations
html_label: "Key + write + Number"
html_match_fragments: ["Key", "write", "Number"]
type: statement
visual_signature: red Firebase write block; key/value inputs
function:
  summary: Writes a value to a Firebase key.
  use_when:
    - store remote value
    - share program state
    - write text/number/bool/list
  avoid_when:
    - local file writing → use write_line_file
inputs:
  - key: string
  - value: any typed value
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Write Key
  - Set key
  - Connect value
example_task: Write score=5 to Firebase.
```

## Read Key

```yaml
block_id: firebase_read
block_name: Read Key
category: data_operations
msg_key: READ_DB
html_category: Data Operations
html_label: "Key + read"
html_match_fragments: ["Key", "read"]
type: value
visual_signature: red Firebase read block; key input
function:
  summary: Reads a value from a Firebase key.
  use_when:
    - retrieve remote value
    - read shared parameter/state
  avoid_when:
    - read local file → use read_line_file
inputs:
  - key: string
outputs: any typed value
instruction_template:
  - Go to Data Operations
  - Drag Read Key into a value socket
  - Set key
example_task: Set x to value from key 'speed'.
```

## Delete Key

```yaml
block_id: firebase_delete_key
block_name: Delete Key
category: data_operations
msg_key: DELETE_KEY
html_category: Data Operations
html_label: "Key + delete"
html_match_fragments: ["Key", "delete"]
type: statement
visual_signature: red Firebase delete key block; key input
function:
  summary: Deletes a Firebase key.
  use_when:
    - remove remote data
    - clear shared state
  avoid_when:
    - delete entire file → use delete_file/storage_delete
inputs:
  - key: string
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Delete Key
  - Set key
example_task: Delete key 'command'.
```

## Wait Until Key Changes

```yaml
block_id: firebase_wait_change
block_name: Wait Until Key Changes
category: data_operations
msg_key: CHANGE_DB
html_category: Data Operations
html_label: "wait until value at key"
html_match_fragments: ["wait until value at key"]
type: statement
visual_signature: red Firebase wait/change block; key input
function:
  summary: Pauses the program until the selected Firebase key changes.
  use_when:
    - wait for remote command
    - sync two devices
    - react only when database updates
  avoid_when:
    - ordinary time wait → use wait
inputs:
  - key: string
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Wait Until Key Changes
  - Set key
  - Place before reading the key
example_task: Wait until key 'start' changes.
```

## Initialize Storage

```yaml
block_id: storage_init
block_name: Initialize Storage
category: data_operations
msg_key: INIT_STORAGE
html_category: Data Operations
html_label: "initialize firebase storage at url"
html_match_fragments: ["initialize firebase storage at url"]
type: statement
visual_signature: red Firebase storage initialize block; URL input
function:
  summary: Connects to Firebase Storage before upload/download/delete storage operations.
  use_when:
    - prepare storage upload
    - prepare storage download
    - use Firebase storage URL
  avoid_when:
    - Firebase database operations → use firebase_init
inputs:
  - url: string
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Initialize Storage
  - Paste storage URL
  - Place before upload/download/delete storage blocks
example_task: Initialize storage at a Firebase storage URL.
```

## Upload File

```yaml
block_id: upload_file
block_name: Upload File
category: data_operations
msg_key: UPLOAD_STORAGE
html_category: Data Operations
html_label: "upload"
html_match_fragments: ["upload"]
type: statement
visual_signature: red storage upload block; filename and file type selector
function:
  summary: Uploads a selected local file to initialized storage.
  use_when:
    - upload csv/image/video/audio
    - send generated file to storage
  avoid_when:
    - save graph locally first → use graph_save
inputs:
  - file_name: string or filename variable
  - type: image/video/audio/csv
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Upload File
  - Set filename or variable
  - Choose file type
example_task: Upload CSV file with filename stored in variable s.
```

## Download File

```yaml
block_id: download_file
block_name: Download File
category: data_operations
msg_key: DOWNLOAD_STORAGE
html_category: Data Operations
html_label: "download"
html_match_fragments: ["download"]
type: statement
visual_signature: red storage download block; filename and file type selector
function:
  summary: Downloads a file from initialized storage.
  use_when:
    - retrieve stored file
    - download CSV/image/audio/video
  avoid_when:
    - load graph from local CSV after download → use graph_load
inputs:
  - file_name: string
  - type: enum
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Download File
  - Set filename
  - Choose type
example_task: Download image file 'photo.jpg'.
```

## Delete File (Storage)

```yaml
block_id: storage_delete
block_name: Delete File (Storage)
category: data_operations
msg_key: DELETE_STORAGE
html_category: Data Operations
html_label: "delete + filename + from storage"
html_match_fragments: ["delete", "filename", "from storage"]
type: statement
visual_signature: red storage delete block; filename and file type selector
function:
  summary: Deletes a file from initialized storage.
  use_when:
    - remove uploaded file
    - cleanup cloud storage
  avoid_when:
    - delete local file → use delete_file
inputs:
  - file_name: string
  - type: enum
outputs: none
instruction_template:
  - Go to Data Operations
  - Drag Delete File (Storage)
  - Set filename
  - Choose type
example_task: Delete uploaded CSV named by variable s.
```

# Smartphone

Use for smartphone-specific data acquisition workflows.

## Data Acquisition

```yaml
block_id: data_acquisition
block_name: Data Acquisition
category: smartphone
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: statement
visual_signature: smartphone data acquisition block; contains file name, sensors, duration, rate
function:
  summary: Samples selected smartphone sensors and saves collected data to a file.
  use_when:
    - record phone sensors
    - save experiment sensor data
    - sample at fixed Hz
  avoid_when:
    - manual plotting of math functions → use graph_draw_point
inputs:
  - file_name: string
  - sensors: list/selected sensors
  - duration_sec: number
  - rate_hz: number 0-100
outputs: none/file depending on implementation
instruction_template:
  - Go to Smartphone
  - Drag Data Acquisition
  - Set file name
  - Select sensors
  - Set duration
  - Set rate
example_task: Record acceleration for 10 seconds at 50 Hz.
```

# Flow Control

Use for program start, loops, timing, conditions, waits, break, exit, and task control.

## Start Program / on start

```yaml
block_id: start_program
block_name: Start Program / on start
category: flow_control
msg_key: INITIATE
html_category: Flow Control
html_label: "on start"
html_match_fragments: ["on start"]
type: container/root
visual_signature: green container block; top says 'on start'; holds other blocks inside
function:
  summary: Program entry point. Blocks inside run when the user presses play/start.
  use_when:
    - start every program
    - wrap all top-level commands
  avoid_when:
    - reusable subroutine → use start_task/my blocks
inputs:
  - none
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag on start / Start Program to workspace
  - Put all program commands inside it
example_task: Begin program with on start.
```

## Start Task

```yaml
block_id: start_task
block_name: Start Task
category: flow_control
msg_key: START_BLOCK
html_category: Flow Control
html_label: "run"
html_match_fragments: ["run"]
type: container
visual_signature: green task container block; separate runnable process
function:
  summary: Defines a separate task/process that can run independently or be stopped.
  use_when:
    - parallel/separate process
    - task-level organization
  avoid_when:
    - main program entry → use start_program
inputs:
  - none
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Start Task
  - Place task commands inside
example_task: Create task that watches sensor value.
```

## Stop Task

```yaml
block_id: stop_task
block_name: Stop Task
category: flow_control
msg_key: STOP_TASK
html_category: Flow Control
html_label: "stop task"
html_match_fragments: ["stop task"]
type: statement
visual_signature: green task control block; stops selected task
function:
  summary: Stops a running task/process.
  use_when:
    - end a background task
    - stop a separate process after condition/time
  avoid_when:
    - exit whole program → use exit_program
inputs:
  - task identifier if available
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Stop Task
  - Choose task if required
example_task: Stop task after 3 seconds.
```

## Repeat N Times

```yaml
block_id: repeat_n
block_name: Repeat N Times
category: flow_control
msg_key: CONTROLS_REPEAT_EXT
html_category: Flow Control
html_label: "times"
html_match_fragments: ["times"]
type: container
visual_signature: green loop block; contains count and do area
function:
  summary: Runs contained blocks a fixed number of times.
  use_when:
    - repeat exact count
    - do same action N times
  avoid_when:
    - loop with changing counter → use repeat_increment
inputs:
  - count: number
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Repeat N Times
  - Set count
  - Place repeated commands inside do area
example_task: Repeat 5 times, beep once each time.
```

## Repeat Until

```yaml
block_id: repeat_until
block_name: Repeat Until
category: flow_control
msg_key: CONTROLS_WHILEUNTILFOREVER
html_category: Flow Control
html_label: "forever"
html_match_fragments: ["forever"]
type: container
visual_signature: green loop block with condition/proposition input
function:
  summary: Repeats contained blocks until/while a condition is met depending on selected mode.
  use_when:
    - loop until sensor/timer/condition
    - unknown number of repetitions
  avoid_when:
    - fixed count → use repeat_n or repeat_increment
inputs:
  - condition: boolean
  - mode: until/while if available
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Repeat Until
  - Connect condition
  - Place commands inside
example_task: Repeat until timer > 10 sec.
```

## Repeat and Increment / count with

```yaml
block_id: repeat_increment
block_name: Repeat and Increment / count with
category: flow_control
msg_key: CONTROLS_FOR
html_category: Flow Control
html_label: "count with"
html_match_fragments: ["count with"]
type: container
visual_signature: green loop block; text like 'count with [var] from [start] to [max] by [step] do'
function:
  summary: Sets a counter variable and increments it from start to max by step, running contained blocks each value.
  use_when:
    - plot functions over x values
    - loop with counter
    - generate x from min to max
  avoid_when:
    - simple repeat without counter → use repeat_n
inputs:
  - variable: integer variable
  - start: number
  - max/to: number
  - step/by: number
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag count with / Repeat and Increment
  - Choose/create counter variable
  - Set from, to, by
  - Place loop body inside do area
example_task: count with angleDeg from -360 to 360 by 90.
```

## If

```yaml
block_id: if_condition
block_name: If
category: flow_control
msg_key: CONTROLS_IF
html_category: Flow Control
html_label: "if + do"
html_match_fragments: ["if", "do"]
type: container
visual_signature: green decision block; contains if condition and do area
function:
  summary: Runs contained blocks only if condition is true.
  use_when:
    - one conditional branch
    - do something only if true
  avoid_when:
    - need else branch → use if_else
inputs:
  - condition: boolean
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag If
  - Connect boolean condition
  - Place true-branch blocks inside
example_task: If x > 10, display high.
```

## If Else

```yaml
block_id: if_else
block_name: If Else
category: flow_control
msg_key: CONTROLS_IF
html_category: Flow Control
html_label: "if + do"
html_match_fragments: ["if", "do"]
type: container
visual_signature: green decision block with if/do/else areas
function:
  summary: Runs one block group if condition is true, otherwise runs the else group.
  use_when:
    - two outcomes
    - if condition otherwise action
  avoid_when:
    - only one branch → use if_condition
inputs:
  - condition: boolean
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag If Else
  - Connect condition
  - Put blocks in if and else areas
example_task: If letter is s delete file, else check binary MSB.
```

## Break

```yaml
block_id: break_loop
block_name: Break
category: flow_control
msg_key: CONTROLS_FLOW_STATEMENTS
html_category: Flow Control
html_label: "break out"
html_match_fragments: ["break out"]
type: statement
visual_signature: green loop-control block; break current/next loop option
function:
  summary: Exits the current or selected loop early.
  use_when:
    - stop loop once condition met
    - avoid remaining iterations
  avoid_when:
    - stop whole program → use exit_program
inputs:
  - mode: current/next loop option
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Break inside a loop
  - Choose break option
example_task: Break after first detected match.
```

## Wait

```yaml
block_id: wait
block_name: Wait
category: flow_control
msg_key: WAIT
html_category: Flow Control
html_label: "wait + sec"
html_match_fragments: ["wait", "sec"]
type: statement
visual_signature: green timing block; number input plus sec/ms dropdown
function:
  summary: Pauses execution for a fixed time.
  use_when:
    - slow down graph drawing
    - wait between actions
    - allow display update
  avoid_when:
    - wait for condition → use conditional_wait
inputs:
  - time: number
  - unit: ms/sec
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Wait
  - Set time
  - Choose ms or sec
example_task: Wait 0.01 sec after each graph point.
```

## Timer Value

```yaml
block_id: timer_value
block_name: Timer Value
category: flow_control
msg_key: READ_TIMER
html_category: Flow Control
html_label: "read + timer 0"
html_match_fragments: ["read", "timer 0"]
type: value
visual_signature: green timer block; timer id and unit selector
function:
  summary: Returns current timer value in selected units.
  use_when:
    - use elapsed time as x value
    - display timer
    - compute time-based values
  avoid_when:
    - compare timer directly → use timer_compare
inputs:
  - timer_id
  - unit: ms/sec
outputs: number
instruction_template:
  - Go to Flow Control
  - Drag Timer Value into numeric socket
  - Choose timer and unit
example_task: Use timer seconds as graph x.
```

## Timer Compare

```yaml
block_id: timer_compare
block_name: Timer Compare
category: flow_control
msg_key: COMPARE_TIMER
html_category: Flow Control
html_label: "is + timer 0"
html_match_fragments: ["is", "timer 0"]
type: value/bool
visual_signature: green timer comparison block; timer id, value, comparison dropdown
function:
  summary: Returns true/false by comparing timer to a chosen value.
  use_when:
    - stop after time
    - conditional wait based on timer
    - if timer > value
  avoid_when:
    - need numeric timer value → use timer_value
inputs:
  - timer_id
  - unit
  - value
  - comparison: =/!=/</<=/>/>=
outputs: boolean
instruction_template:
  - Go to Flow Control
  - Drag Timer Compare into condition socket
  - Set timer, unit, value, comparison
example_task: Repeat until timer >= 10 sec.
```

## Reset Timer

```yaml
block_id: reset_timer
block_name: Reset Timer
category: flow_control
msg_key: RESET_TIMER
html_category: Flow Control
html_label: "reset + timer"
html_match_fragments: ["reset", "timer"]
type: statement
visual_signature: green reset timer block; timer id input
function:
  summary: Resets selected timer to zero.
  use_when:
    - start timing from now
    - clear timer before measurement
  avoid_when:
    - reset graph → use graph_reset
inputs:
  - timer_id
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Reset Timer
  - Choose timer
example_task: Reset timer before repeat_until loop.
```

## Conditional Wait / Wait For

```yaml
block_id: conditional_wait
block_name: Conditional Wait / Wait For
category: flow_control
msg_key: WAIT_TIMER
html_category: Flow Control
html_label: "wait until + timer 0"
html_match_fragments: ["wait until", "timer 0"]
type: statement
visual_signature: green wait-for block; condition/comparison input
function:
  summary: Pauses program until condition becomes true.
  use_when:
    - wait for sensor threshold
    - wait for timer condition
    - wait for virtual input
  avoid_when:
    - fixed time pause → use wait
inputs:
  - condition: boolean
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Conditional Wait / Wait For
  - Connect boolean condition
example_task: Wait until angle >= 90.
```

## Exit Program

```yaml
block_id: exit_program
block_name: Exit Program
category: flow_control
msg_key: STOP_PROGRAM
html_category: Flow Control
html_label: "stop program and exit"
html_match_fragments: ["stop program and exit"]
type: statement
visual_signature: green exit block
function:
  summary: Stops the whole program immediately.
  use_when:
    - end program early
    - stop after error/condition
  avoid_when:
    - stop only one task → use stop_task
inputs:
  - none
outputs: none
instruction_template:
  - Go to Flow Control
  - Drag Exit Program inside condition or sequence
example_task: If timer > 10 sec, exit program.
```

# Logic

Use for boolean logic, bitwise operations, and binary/decimal conversion.

## Logical Condition

```yaml
block_id: logical_condition
block_name: Logical Condition
category: logic
msg_key: LOGIC_BOOLEAN
html_category: Logic
html_label: "true"
html_match_fragments: ["true"]
type: value/bool
visual_signature: blue logic block; proposition/boolean expression slot
function:
  summary: Creates/evaluates a boolean condition.
  use_when:
    - build true/false expression
    - feed if/repeat/wait condition
  avoid_when:
    - numeric comparison → use number_compare when comparing numbers
inputs:
  - condition/proposition
outputs: boolean
instruction_template:
  - Go to Logic
  - Drag Logical Condition into condition socket
  - Build/connect proposition
example_task: Use true condition in if block.
```

## Not

```yaml
block_id: not_operator
block_name: Not
category: logic
msg_key: LOGIC_NEGATE
html_category: Logic
html_label: "false + not"
html_match_fragments: ["false", "not"]
type: value
visual_signature: blue logic NOT block
function:
  summary: Inverts boolean/bit value.
  use_when:
    - reverse condition
    - convert true to false
    - invert bit
  avoid_when:
    - numeric negative → use unary_operation neg
inputs:
  - value: bool/bit
outputs: bool/bit
instruction_template:
  - Go to Logic
  - Drag Not
  - Connect value to invert
example_task: If not touch_sensor then wait.
```

## Bitwise Operation

```yaml
block_id: bitwise_operation
block_name: Bitwise Operation
category: logic
msg_key: LOGIC_OPERATION_NUMERIC_EXTENDED
html_category: Logic
html_label: "128"
html_match_fragments: ["128"]
type: value
visual_signature: blue bitwise block; two operands and operator dropdown
function:
  summary: Performs bitwise operations on 8-bit numbers.
  use_when:
    - AND/OR/XOR/rotate bits
    - manipulate LED/switch values
  avoid_when:
    - boolean if conditions → use logical_condition/number_compare
inputs:
  - a: number 0-255
  - b: number 0-255
  - operation: and/or/xor/rotateL/rotateR
outputs: number 0-255
instruction_template:
  - Go to Logic
  - Drag Bitwise Operation
  - Set operands
  - Choose operation
example_task: Compute 2 AND 3.
```

## Binary to Decimal

```yaml
block_id: binary_to_decimal
block_name: Binary to Decimal
category: logic
msg_key: CONVERTERS_B2D
html_category: Logic
html_label: "to decimal"
html_match_fragments: ["to decimal"]
type: value
visual_signature: blue converter block; four bit inputs bit0-bit3
function:
  summary: Converts 4 binary bits to decimal 0-15.
  use_when:
    - convert switch bits to number
    - interpret binary output
  avoid_when:
    - decimal to bits → use decimal_to_binary
inputs:
  - bit0 LSB
  - bit1
  - bit2
  - bit3 MSB
outputs: number 0-15
instruction_template:
  - Go to Logic
  - Drag Binary to Decimal
  - Set/connect four bits
example_task: Convert 1010 to decimal.
```

## Decimal to Binary

```yaml
block_id: decimal_to_binary
block_name: Decimal to Binary
category: logic
msg_key: CONVERTERS_D2B
html_category: Logic
html_label: "to binary"
html_match_fragments: ["to binary"]
type: value/multi-output
visual_signature: blue converter block; decimal input and outputs bit0-bit3
function:
  summary: Converts decimal 0-15 to four binary bits; bit3 is MSB.
  use_when:
    - check MSB
    - show decimal as binary
    - drive LEDs/conditions by bits
  avoid_when:
    - binary bits to decimal → use binary_to_decimal
inputs:
  - number: decimal 0-15
outputs: bit0 LSB, bit1, bit2, bit3 MSB
instruction_template:
  - Go to Logic
  - Drag Decimal to Binary
  - Connect number
  - Use bit3 output when task says MSB
example_task: Convert random number n to binary, check MSB bit3.
important_note: bit3 is MSB and bit0 is LSB for 4-bit output
```

## Conditional Value

```yaml
block_id: conditional_value
block_name: Conditional Value
category: logic
msg_key: LOGIC_TERNARY
html_category: Logic
html_label: "test"
html_match_fragments: ["test"]
type: value
visual_signature: blue ternary block; condition, true value, false value
function:
  summary: Returns one value if condition is true and another if false.
  use_when:
    - choose value inside expression
    - set variable based on condition
  avoid_when:
    - run blocks conditionally → use if/if_else
inputs:
  - condition: boolean
  - true_value
  - false_value
outputs: value
instruction_template:
  - Go to Logic
  - Drag Conditional Value into value socket
  - Connect condition
  - Set true and false values
example_task: Set x to 1 if y is true, else 0.
```

# Math

Use for numeric constants, arithmetic, custom expressions, trig, random, compare, range, statistics.

## Integer Value

```yaml
block_id: int_value
block_name: Integer Value
category: math
msg_key: MATH_NUMBER
html_category: Math
html_label: "123"
html_match_fragments: ["123"]
type: value
visual_signature: green number block; constant integer field
function:
  summary: Provides a hard-coded integer/number value.
  use_when:
    - enter numeric constants
    - set loop ranges
    - supply min/max/step values
  avoid_when:
    - computed expression → use math_expression/math_operation
inputs:
  - number literal
outputs: number
instruction_template:
  - Go to Math
  - Drag Integer Value into numeric socket
  - Type number
example_task: Use 360 as loop max.
```

## Operation (2 values)

```yaml
block_id: math_operation
block_name: Operation (2 values)
category: math
msg_key: MATH_ARITHMETIC
html_category: Math
html_label: "+"
html_match_fragments: ["+"]
type: value
visual_signature: green operation block; two numeric sockets and operator dropdown
function:
  summary: Performs one arithmetic operation on two values.
  use_when:
    - simple + - * / ^
    - combine two numbers
  avoid_when:
    - multi-part formula or typed expression → use math_expression
inputs:
  - a: number
  - b: number
  - operation: + - * / ^
outputs: number
instruction_template:
  - Go to Math
  - Drag Operation (2 values)
  - Connect a and b
  - Choose operation
example_task: Compute x + 1.
```

## Expression (a,b,c,x)

```yaml
block_id: math_expression
block_name: Expression (a,b,c,x)
category: math
msg_key: MATH_ADVANCED
html_category: Math
html_label: "a*x^2+b*x+c"
html_match_fragments: ["a*x^2+b*x+c"]
type: value
visual_signature: green value block with white free-text formula field and labels a= b= c= x=; example text 'x*3.1416/180 a=1 b=1 c=1 x=angleDeg'
function:
  summary: Evaluates a custom numeric formula written as text using parameters a, b, c, and x.
  use_when:
    - formula not available as simple block
    - degrees-to-radians conversion
    - polynomial/custom expression
    - scaling x-axis before graphing
  avoid_when:
    - direct sin/cos/tan calculation → use trig_function
    - one simple + operation → use math_operation
inputs:
  - expression_string: string examples 'x*3.1416/180', 'a*x*x+b*x+c'
  - a: number
  - b: number
  - c: number
  - x: number/variable
outputs: number
instruction_template:
  - Go to Math
  - Drag Expression (a,b,c,x) into value slot
  - Type formula in white text field
  - Fill a/b/c inputs
  - Put source variable into x input
example_task: Set xRad to expression 'x*3.1416/180' with x=angleDeg.
common_recipes:
  degrees_to_radians:
    task: convert loop angle in degrees to radians for graph x-axis
    expression_string: "x*3.1416/180"
    a: 1
    b: 1
    c: 1
    x: angleDeg
    output_variable: xRad
  polynomial:
    expression_string: "a*x*x+b*x+c"
    use_for: parabolas and custom formulas
```

## Unary Operation

```yaml
block_id: unary_operation
block_name: Unary Operation
category: math
msg_key: MATH_SINGLE
html_category: Math
html_label: "square root"
html_match_fragments: ["square root"]
type: value
visual_signature: green single-input operation block; dropdown includes sqrt, abs, ln, exp
function:
  summary: Applies a one-input numeric function.
  use_when:
    - sqrt(x)
    - absolute value
    - negative
    - log/exp/powers
  avoid_when:
    - trig functions → use trig_function
    - multi-input formula → use math_expression
inputs:
  - value: number
  - operation: sqrt/abs/neg/ln/log10/exp/10^x/2^x
outputs: number
instruction_template:
  - Go to Math
  - Drag Unary Operation
  - Choose operation
  - Connect value
example_task: Compute sqrt(x).
```

## Trigonometric Function

```yaml
block_id: trig_function
block_name: Trigonometric Function
category: math
msg_key: MATH_TRIG
html_category: Math
html_label: "sin"
html_match_fragments: ["sin"]
type: value
visual_signature: green trig block; dropdown sin/cos/tan/asin/acos/atan and numeric input
function:
  summary: Computes trigonometric function. Input angle is in degrees for sin/cos/tan.
  use_when:
    - calculate sin/cos/tan of angle in degrees
    - plot sine/cosine y-values
  avoid_when:
    - convert degrees to radians for graph x-axis → use math_expression
    - sqrt/log → use unary_operation
inputs:
  - value: number in degrees
  - operation: sin/cos/tan/asin/acos/atan
outputs: number
instruction_template:
  - Go to Math
  - Drag Trigonometric Function
  - Choose sin/cos/tan
  - Put angleDeg variable into input
example_task: Set ySin to sin(angleDeg).
important_note: input for sin/cos/tan is degrees; do not feed radians into this block unless the environment explicitly changed settings
paired_recipe: for graph x-axis in radians, compute y with angleDeg but draw x using xRad from math_expression
```

## Rounding & Numeric Ops

```yaml
block_id: rounding
block_name: Rounding & Numeric Ops
category: math
msg_key: MATH_ROUND
html_category: Math
html_label: "round"
html_match_fragments: ["round"]
type: value
visual_signature: green rounding block; dropdown round/ceil/floor/truncate/remainder/int_div
function:
  summary: Applies rounding or integer-style numeric operation.
  use_when:
    - clean display formatting
    - truncate coefficient
    - integer division/remainder
  avoid_when:
    - ordinary arithmetic → use math_operation
inputs:
  - value: number
  - operation: round/ceil/floor/truncate/remainder/int_div
outputs: number
instruction_template:
  - Go to Math
  - Drag Rounding & Numeric Ops
  - Choose operation
  - Connect value
example_task: Truncate slope before showing on LCD.
```

## List Statistics

```yaml
block_id: list_statistics
block_name: List Statistics
category: math
msg_key: MATH_ON_LIST
html_category: Math
html_label: "sum"
html_match_fragments: ["sum"]
type: value
visual_signature: green statistics block; list input and operation selector
function:
  summary: Computes a statistic from a numeric list.
  use_when:
    - sum/average/min/max/list analysis
    - analyze collected values
  avoid_when:
    - single number operation → use unary_operation
inputs:
  - list: numeric list
  - operation: sum/min/max/average/median/mode/std/random item
outputs: number/value
instruction_template:
  - Go to Math
  - Drag List Statistics
  - Connect list
  - Choose statistic
example_task: Compute average velocity list.
```

## Constrain Value

```yaml
block_id: constrain_value
block_name: Constrain Value
category: math
msg_key: MATH_CONSTRAIN
html_category: Math
html_label: "constrain"
html_match_fragments: ["constrain"]
type: value
visual_signature: green clamp block; min/max/value inputs
function:
  summary: Clamps value between min and max limits.
  use_when:
    - keep motor power safe
    - limit display/bar range
    - prevent out-of-range values
  avoid_when:
    - test whether inside range → use range_check
inputs:
  - min: number
  - max: number
  - value: number
outputs: number between min and max
instruction_template:
  - Go to Math
  - Drag Constrain Value
  - Set min/max
  - Connect value
example_task: Constrain speed between -100 and 100.
```

## Arctan2

```yaml
block_id: atan2
block_name: Arctan2
category: math
msg_key: MATH_ATAN2
html_category: Math
html_label: "atan2 of X:"
html_match_fragments: ["atan2 of X:"]
type: value
visual_signature: green atan2 block; x and y inputs
function:
  summary: Computes angle of point/vector using x,y coordinates, range -180 to 180 degrees.
  use_when:
    - convert joystick x/y to direction angle
    - compute vector angle
  avoid_when:
    - simple tan inverse of one number → use trig_function atan
inputs:
  - x: number
  - y: number
outputs: number -180 to 180
instruction_template:
  - Go to Math
  - Drag Arctan2
  - Connect x and y
example_task: Compute joystick direction angle.
```

## Random Fraction

```yaml
block_id: random_fraction
block_name: Random Fraction
category: math
msg_key: MATH_RANDOM_FLOAT
html_category: Math
html_label: "random fraction"
html_match_fragments: ["random fraction"]
type: value
visual_signature: green random block; no inputs; returns 0-1 fraction
function:
  summary: Generates random decimal in [0,1).
  use_when:
    - probability
    - random scaling
    - simulation
  avoid_when:
    - random whole number range → use random_integer
inputs:
  - none
outputs: number 0 <= value < 1
instruction_template:
  - Go to Math
  - Drag Random Fraction into numeric socket
example_task: If random fraction < 0.5, choose A.
```

## Random Integer

```yaml
block_id: random_integer
block_name: Random Integer
category: math
msg_key: MATH_RANDOM_INT
html_category: Math
html_label: "random integer from"
html_match_fragments: ["random integer from"]
type: value
visual_signature: green random integer block; min/max inputs
function:
  summary: Generates random integer between min and max inclusive.
  use_when:
    - random index
    - random choice by number
    - dice-like behavior
  avoid_when:
    - random decimal → use random_fraction
inputs:
  - min: integer
  - max: integer
outputs: integer
instruction_template:
  - Go to Math
  - Drag Random Integer
  - Set min
  - Set max
  - Use output to set variable
example_task: Set n to random integer 1 to 5.
```

## Number Property Check

```yaml
block_id: number_property
block_name: Number Property Check
category: math
msg_key: MATH_NUMBER_PROPERTY
html_category: Math
html_label: "even"
html_match_fragments: ["even"]
type: value/bool
visual_signature: green property check block; number input and property dropdown
function:
  summary: Checks whether a number satisfies selected property.
  use_when:
    - even/odd/prime/positive/negative/divisible tests
    - condition by numeric property
  avoid_when:
    - compare two numbers → use number_compare
inputs:
  - value: number
  - property: even/odd/prime/positive/negative/divisible
outputs: boolean
instruction_template:
  - Go to Math
  - Drag Number Property Check into condition socket
  - Choose property
  - Connect value
example_task: If n is even, display even.
```

## Number Comparison

```yaml
block_id: number_compare
block_name: Number Comparison
category: math
msg_key: LOGIC_COMPARE
html_category: Math
html_label: "="
html_match_fragments: ["="]
type: value/bool
visual_signature: green compare block; two inputs and operator dropdown
function:
  summary: Compares two numeric values and returns true/false.
  use_when:
    - x > 10
    - timer <= 5
    - sensor equals threshold
  avoid_when:
    - string comparison → use compare_strings
inputs:
  - a: number
  - b: number
  - operator: = != < <= > >=
outputs: boolean
instruction_template:
  - Go to Math
  - Drag Number Comparison into condition socket
  - Connect a and b
  - Choose operator
example_task: If sound > 80.
```

## Range Check

```yaml
block_id: range_check
block_name: Range Check
category: math
msg_key: MATH_IN_RANGE
html_category: Math
html_label: "inside"
html_match_fragments: ["inside"]
type: value/bool
visual_signature: green range block; value/min/max/mode inputs
function:
  summary: Checks whether a value is inside or outside a range.
  use_when:
    - threshold bands
    - valid input range
    - sensor in range
  avoid_when:
    - force value into range → use constrain_value
inputs:
  - value: number
  - min: number
  - max: number
  - mode: inside/outside
outputs: boolean
instruction_template:
  - Go to Math
  - Drag Range Check
  - Set value/min/max
  - Choose inside or outside
example_task: If angle is inside 0 to 90.
```

# Variables

Use for storing, retrieving, comparing, incrementing, or toggling named values.

## Set Variable

```yaml
block_id: set_variable
block_name: Set Variable
category: variables
msg_key: VAR_SET
html_category: Variables
html_label: "0 set x to"
type: statement
visual_signature: variable block; text like 'set [var] to [value]'
function:
  summary: Assigns a value to a variable.
  use_when:
    - initialize variables
    - store calculation result
    - save sensor/text/random output
  avoid_when:
    - increment existing integer → use change_variable
inputs:
  - variable: chosen variable
  - value: matching typed value
outputs: none
instruction_template:
  - Go to Variables
  - Create variable if needed
  - Drag Set Variable
  - Choose variable
  - Connect value
example_task: Set xRad to radians expression.
```

## Get Variable

```yaml
block_id: get_variable
block_name: Get Variable
category: variables
msg_key: VAR_GET
html_category: Variables
html_label: "x"
type: value
visual_signature: small variable value block with variable name dropdown
function:
  summary: Returns current variable value.
  use_when:
    - reuse stored value
    - feed variable into math/display/condition
  avoid_when:
    - assign new value → use set_variable
inputs:
  - variable selection
outputs: value
instruction_template:
  - Go to Variables
  - Drag variable value block
  - Choose variable
  - Plug into matching socket
example_task: Use x as graph X value.
```

## Change Integer Variable

```yaml
block_id: change_variable
block_name: Change Integer Variable
category: variables
msg_key: VAR_CHANGE
html_category: Variables
html_label: "1 change x by"
type: statement
visual_signature: variable block; text like 'change [var] by [delta]'
function:
  summary: Adds/subtracts delta to an integer variable.
  use_when:
    - increment counter
    - count events
    - update score
  avoid_when:
    - set exact value → use set_variable
inputs:
  - variable: integer variable
  - delta: integer
outputs: none
instruction_template:
  - Go to Variables
  - Drag Change Integer Variable
  - Choose variable
  - Set delta
example_task: Increment count by 1.
```

## Compare Variable

```yaml
block_id: compare_variable
block_name: Compare Variable
category: variables
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: value/bool
visual_signature: variable comparison block; variable dropdown and comparison value
function:
  summary: Compares variable value to another value.
  use_when:
    - check variable equals/greater/less than
    - if variable reached target
  avoid_when:
    - compare arbitrary numbers → use number_compare
inputs:
  - variable
  - value
  - operator if available
outputs: boolean
instruction_template:
  - Go to Variables
  - Drag Compare Variable into condition
  - Choose variable
  - Set comparison value
example_task: If count > 3.
```

## Toggle Bool

```yaml
block_id: toggle_bool
block_name: Toggle Bool
category: variables
msg_key: VAR_TOGGLE
html_category: Variables
html_label: "1 ⁣ x ="
type: statement
visual_signature: boolean variable block; flips true/false
function:
  summary: Flips a boolean variable from true to false or false to true.
  use_when:
    - toggle state
    - alternate behavior
    - switch mode
  avoid_when:
    - numeric increment → use change_variable
inputs:
  - variable: boolean variable
outputs: none
instruction_template:
  - Go to Variables
  - Drag Toggle Bool
  - Choose boolean variable
example_task: Toggle isRunning.
```

# Text

Use for string creation, comparison, length, character access, substring, case conversion, translation, links.

## String Value

```yaml
block_id: string_value
block_name: String Value
category: text
msg_key: MY_TEXT
html_category: Text
html_label: "(empty text constant - positional)"
html_match_fragments: ["__POSITIONAL_0__"]
type: value
visual_signature: yellow string block; quoted text field(s), can join strings
function:
  summary: Creates a string literal or joins string parts.
  use_when:
    - hard-code text
    - build message
    - make filename/question text
  avoid_when:
    - append to variable in-place → use append_text
inputs:
  - values: one or more strings/variables
outputs: string
instruction_template:
  - Go to Text
  - Drag String Value
  - Type text or connect parts
example_task: Create string 'test csv'.
```

## Compare Strings

```yaml
block_id: compare_strings
block_name: Compare Strings
category: text
msg_key: LOGIC_TEXT_COMPARE
html_category: Text
html_label: "="
html_match_fragments: ["="]
type: value/bool
visual_signature: yellow compare strings block; two string inputs A and B
function:
  summary: Checks whether two strings are equal.
  use_when:
    - if letter equals 's'
    - compare command/name/text
  avoid_when:
    - compare numbers → use number_compare
inputs:
  - a: string
  - b: string
outputs: boolean
instruction_template:
  - Go to Text
  - Drag Compare Strings into condition
  - Connect A and B
example_task: Check if c equals 's'.
```

## Is String Empty

```yaml
block_id: is_empty_string
block_name: Is String Empty
category: text
msg_key: TEXT_ISEMPTY
html_category: Text
html_label: "is empty"
html_match_fragments: ["is empty"]
type: value/bool
visual_signature: yellow empty-string block; one text input
function:
  summary: Returns true if text is empty.
  use_when:
    - validate user input
    - check missing SMS/voice text
  avoid_when:
    - list empty → use list_is_empty
inputs:
  - text: string
outputs: boolean
instruction_template:
  - Go to Text
  - Drag Is String Empty
  - Connect text
example_task: If keyboard input is empty.
```

## String Length

```yaml
block_id: string_length
block_name: String Length
category: text
msg_key: TEXT_LENGTH
html_category: Text
html_label: "abc + length of"
html_match_fragments: ["abc", "length of"]
type: value
visual_signature: yellow length block; one text input
function:
  summary: Returns number of characters in a string.
  use_when:
    - validate text length
    - choose random character index
    - loop over text
  avoid_when:
    - list length → use list_length
inputs:
  - text: string
outputs: number
instruction_template:
  - Go to Text
  - Drag String Length
  - Connect text
example_task: Get length of variable s.
```

## Append Text

```yaml
block_id: append_text
block_name: Append Text
category: text
msg_key: MY_TEXT_APPEND
html_category: Text
html_label: "append text"
html_match_fragments: ["append text"]
type: statement
visual_signature: yellow append block; variable plus text input
function:
  summary: Appends text to an existing string variable.
  use_when:
    - build message gradually
    - add value to string log
  avoid_when:
    - create one-off joined string → use string_value
inputs:
  - variable: string variable
  - text: string
outputs: none
instruction_template:
  - Go to Text
  - Drag Append Text
  - Choose string variable
  - Connect text to append
example_task: Append ', done' to message.
```

## Char At

```yaml
block_id: char_at
block_name: Char At
category: text
msg_key: TEXT_CHARAT
html_category: Text
html_label: "get + letter #"
html_match_fragments: ["get", "letter #"]
type: value
visual_signature: yellow char-at block; text input and index input
function:
  summary: Returns character at a given index/position in a string.
  use_when:
    - get random letter from text
    - inspect character
    - parse command
  avoid_when:
    - find substring position → use find_substring
inputs:
  - text: string
  - index: number; must be valid
outputs: single-character string
instruction_template:
  - Go to Text
  - Drag Char At into value socket
  - Connect text variable
  - Connect index number
example_task: Get letter at random position n in s.
```

## Find Substring

```yaml
block_id: find_substring
block_name: Find Substring
category: text
msg_key: TEXT_INDEXOF
html_category: Text
html_label: "occurrence of text"
html_match_fragments: ["occurrence of text"]
type: value
visual_signature: yellow find substring block; text and substring inputs
function:
  summary: Returns index of first/last substring occurrence; returns -1 if not found.
  use_when:
    - check where text appears
    - parse command string
  avoid_when:
    - get character at known index → use char_at
inputs:
  - text: string
  - substring: string
outputs: number index or -1
instruction_template:
  - Go to Text
  - Drag Find Substring
  - Connect text and substring
example_task: Find index of 'csv' in s.
```

## Get Substring

```yaml
block_id: get_substring
block_name: Get Substring
category: text
msg_key: TEXT_GETSUBSTRING
html_category: Text
html_label: "get substring from"
html_match_fragments: ["get substring from"]
type: value
visual_signature: yellow substring block; text/start/end inputs
function:
  summary: Extracts a substring between indexes.
  use_when:
    - slice part of text
    - extract command/file extension
  avoid_when:
    - single character → use char_at
inputs:
  - text: string
  - start: number
  - end: number
outputs: string
instruction_template:
  - Go to Text
  - Drag Get Substring
  - Connect text
  - Set start/end
example_task: Extract characters 0 to 3.
```

## Case Conversion

```yaml
block_id: case_convert
block_name: Case Conversion
category: text
msg_key: TEXT_CHANGECASE
html_category: Text
html_label: "UPPER CASE"
html_match_fragments: ["UPPER CASE"]
type: value
visual_signature: yellow case block; text input and upper/lower/title dropdown
function:
  summary: Converts text case.
  use_when:
    - normalize user input
    - format labels/messages
  avoid_when:
    - translation → use translate_text
inputs:
  - text: string
  - mode: upper/lower/title
outputs: string
instruction_template:
  - Go to Text
  - Drag Case Conversion
  - Connect text
  - Choose mode
example_task: Convert command to lower case.
```

## Translate

```yaml
block_id: translate_text
block_name: Translate
category: text
msg_key: TRANSLATE
html_category: Text
html_label: "translate"
html_match_fragments: ["translate"]
type: value
visual_signature: yellow translate block; source language, text, target language
function:
  summary: Translates text from one language to another.
  use_when:
    - multilingual display
    - translate user text
  avoid_when:
    - ask external question → use ask_llm
inputs:
  - source_lang
  - target_lang
  - text
outputs: translated string
instruction_template:
  - Go to Text
  - Drag Translate
  - Choose source and target languages
  - Connect text
example_task: Translate 'Hello' from English to Hebrew.
```

## Run Link

```yaml
block_id: run_link
block_name: Run Link
category: text
msg_key: RUN_LINK
html_category: Text
html_label: "run link at url"
html_match_fragments: ["run link at url"]
type: statement
visual_signature: yellow URL/link block; web link text input
function:
  summary: Opens/runs a web link.
  use_when:
    - open website
    - launch a URL
  avoid_when:
    - ask search/LLM question → use ask_llm
inputs:
  - url: string
outputs: none
instruction_template:
  - Go to Text
  - Drag Run Link
  - Enter URL
example_task: Open robo-phone.com.
```

# Lists

Use for creating, editing, querying, converting, or sorting arrays/lists.

## Create Empty List

```yaml
block_id: create_list
block_name: Create Empty List
category: lists
msg_key: LISTS_CREATE_EMPTY
html_category: Lists
html_label: "create empty list"
html_match_fragments: ["create empty list"]
type: value
visual_signature: list block; creates []
function:
  summary: Creates an empty list.
  use_when:
    - initialize list variable
    - collect values later
  avoid_when:
    - known initial values → use list_init
inputs:
  - none
outputs: empty list
instruction_template:
  - Go to Lists
  - Drag Create Empty List
  - Use it in Set Variable
example_task: Set values to empty list.
```

## Initialize List

```yaml
block_id: list_init
block_name: Initialize List
category: lists
msg_key: LISTS_CREATE_WITH
html_category: Lists
html_label: "create list with"
html_match_fragments: ["create list with"]
type: value
visual_signature: list block with length and item values
function:
  summary: Creates a list with predefined values/length.
  use_when:
    - make starting list
    - prepare fixed list of values
  avoid_when:
    - all repeated same value → use list_repeat
inputs:
  - length
  - values
outputs: list
instruction_template:
  - Go to Lists
  - Drag Initialize List
  - Set length
  - Fill values
example_task: Create list [1,2,3].
```

## Repeat Value List

```yaml
block_id: list_repeat
block_name: Repeat Value List
category: lists
msg_key: LISTS_REPEAT
html_category: Lists
html_label: "create list with item"
html_match_fragments: ["create list with item"]
type: value
visual_signature: list block with length and repeated value
function:
  summary: Creates list by repeating same value.
  use_when:
    - initialize same placeholder values
    - make fixed-size default list
  avoid_when:
    - different values → use list_init
inputs:
  - length
  - value
outputs: list
instruction_template:
  - Go to Lists
  - Drag Repeat Value List
  - Set length
  - Set repeated value
example_task: Create ['x','x','x'].
```

## List Length

```yaml
block_id: list_length
block_name: List Length
category: lists
msg_key: LISTS_LENGTH
html_category: Lists
html_label: "{listVariable} + length of"
html_match_fragments: ["{listVariable}", "length of"]
type: value
visual_signature: list length block; one list input
function:
  summary: Returns number of elements in list.
  use_when:
    - check list size
    - condition if size > 3
    - loop over list
  avoid_when:
    - string length → use string_length
inputs:
  - list
outputs: number
instruction_template:
  - Go to Lists
  - Drag List Length
  - Connect list
example_task: If list length > 3, send SMS.
```

## List Is Empty

```yaml
block_id: list_is_empty
block_name: List Is Empty
category: lists
msg_key: LISTS_ISEMPTY
html_category: Lists
html_label: "is empty"
html_match_fragments: ["is empty"]
type: value/bool
visual_signature: list empty check block; one list input
function:
  summary: Returns true if list has no elements.
  use_when:
    - validate list has values
    - conditional if no collected data
  avoid_when:
    - empty string → use is_empty_string
inputs:
  - list
outputs: boolean
instruction_template:
  - Go to Lists
  - Drag List Is Empty
  - Connect list
example_task: If events list is empty.
```

## Find Element

```yaml
block_id: list_find
block_name: Find Element
category: lists
msg_key: LISTS_INDEXOF
html_category: Lists
html_label: "occurrence of item"
html_match_fragments: ["occurrence of item"]
type: value
visual_signature: list find block; list and value inputs
function:
  summary: Finds index of first/last occurrence of a value in a list.
  use_when:
    - locate value
    - check item position
  avoid_when:
    - substring in text → use find_substring
inputs:
  - list
  - value
  - first/last mode if available
outputs: number index or -1
instruction_template:
  - Go to Lists
  - Drag Find Element
  - Connect list and value
example_task: Find first index of 'abc'.
```

## Get/Remove Element

```yaml
block_id: list_get_remove
block_name: Get/Remove Element
category: lists
msg_key: LISTS_GETINDEX
html_category: Lists
html_label: "get + #"
html_match_fragments: ["get", "#"]
type: value/statement
visual_signature: list block with get/remove mode and index
function:
  summary: Gets, removes, or gets-and-removes an element at an index.
  use_when:
    - read list item
    - pop item
    - remove selected value by index
  avoid_when:
    - set/insert value → use list_set_insert
inputs:
  - list
  - index
  - mode: get/remove/get+remove
outputs: value or none
instruction_template:
  - Go to Lists
  - Drag Get/Remove Element
  - Choose list
  - Set index
  - Choose mode
example_task: Get item at index 0.
```

## Set/Insert Element

```yaml
block_id: list_set_insert
block_name: Set/Insert Element
category: lists
msg_key: LISTS_SETINDEX
html_category: Lists
html_label: "set + as"
html_match_fragments: ["set", "as"]
type: statement
visual_signature: list block with set/insert mode, index, value
function:
  summary: Sets or inserts value into list at index.
  use_when:
    - add collected value
    - update list element
  avoid_when:
    - retrieve item → use list_get_remove
inputs:
  - list
  - index
  - value
  - mode: set/insert
outputs: none
instruction_template:
  - Go to Lists
  - Drag Set/Insert Element
  - Choose list
  - Set index
  - Connect value
  - Choose set/insert
example_task: Insert count value into list.
```

## Sublist

```yaml
block_id: list_sublist
block_name: Sublist
category: lists
msg_key: LISTS_GETSUBLIST
html_category: Lists
html_label: "get sub-list from"
html_match_fragments: ["get sub-list from"]
type: value
visual_signature: list block with start/end indexes
function:
  summary: Returns a portion of a list.
  use_when:
    - slice list
    - keep range of values
  avoid_when:
    - text substring → use get_substring
inputs:
  - list
  - start
  - end
outputs: list
instruction_template:
  - Go to Lists
  - Drag Sublist
  - Connect list
  - Set start/end
example_task: Take first 5 values.
```

## List/Text Conversion

```yaml
block_id: list_text_convert
block_name: List/Text Conversion
category: lists
msg_key: LISTS_SPLIT
html_category: Lists
html_label: "list from text"
html_match_fragments: ["list from text"]
type: value
visual_signature: list/text conversion block; delimiter and mode selector
function:
  summary: Converts text to list or list to text using delimiter.
  use_when:
    - CSV parsing
    - send list as SMS text
    - split comma-separated text
  avoid_when:
    - translate text → use translate_text
inputs:
  - value: list or text
  - delimiter
  - mode: text_to_list/list_to_text
outputs: list or text
instruction_template:
  - Go to Lists
  - Drag List/Text Conversion
  - Choose mode
  - Connect value
  - Set delimiter
example_task: Convert event list to comma-separated text.
```

## Sort List

```yaml
block_id: list_sort
block_name: Sort List
category: lists
msg_key: LISTS_SORT
html_category: Lists
html_label: "sort"
html_match_fragments: ["sort"]
type: value
visual_signature: list sort block; mode/order selector
function:
  summary: Sorts list alphabetically or numerically.
  use_when:
    - order collected values
    - prepare sorted output
  avoid_when:
    - find min/max only → use list_statistics
inputs:
  - list
  - mode/order
outputs: sorted list
instruction_template:
  - Go to Lists
  - Drag Sort List
  - Connect list
  - Choose sort mode
example_task: Sort values ascending.
```

# Robot

Use for robot movement, motors, servos, sensors, PID, name configuration.

## Move Steering

```yaml
block_id: move_steering
block_name: Move Steering
category: robot
msg_key: MOVE_STEERING
html_category: Common
html_label: "move steering"
html_match_fragments: ["move steering"]
type: statement
visual_signature: orange robot movement block; steering/power/time/degrees/brake/complete inputs
function:
  summary: Moves robot with steering and power control.
  use_when:
    - drive straight or turn by steering
    - robot motion over time/degrees
  avoid_when:
    - independent wheel control → use move_tank
inputs:
  - steering: -100 to 100
  - power
  - time
  - degrees/revolutions
  - brake
  - complete
outputs: none
instruction_template:
  - Go to Robot
  - Drag Move Steering
  - Set steering
  - Set power
  - Set time or degrees
  - Set brake and complete flags
example_task: Move straight with steering 0.
```

## Move Direction

```yaml
block_id: move_direction
block_name: Move Direction
category: robot
msg_key: MOVE_DIRECTION
html_category: Common
html_label: "move direction"
html_match_fragments: ["move direction"]
type: statement
visual_signature: orange robot direction block; clockwise/counterclockwise and angle
function:
  summary: Moves robot with directional turning control.
  use_when:
    - precise turn
    - clockwise/counterclockwise movement
  avoid_when:
    - continuous steering curve → use move_steering
inputs:
  - direction: clockwise/counterclockwise
  - power
  - angle
  - complete
outputs: none
instruction_template:
  - Go to Robot
  - Drag Move Direction
  - Choose direction
  - Set power and angle
example_task: Turn clockwise 90 degrees.
```

## Move Tank

```yaml
block_id: move_tank
block_name: Move Tank
category: robot
msg_key: MOVE_TANK
html_category: Common
html_label: "move tank"
html_match_fragments: ["move tank"]
type: statement
visual_signature: orange tank movement block; left/right power inputs
function:
  summary: Controls left/right motors independently.
  use_when:
    - tank steering
    - different power per wheel
    - manual wheel control
  avoid_when:
    - simple steering value → use move_steering
inputs:
  - left_power
  - right_power
  - time
  - degrees
  - brake
  - complete
outputs: none
instruction_template:
  - Go to Robot
  - Drag Move Tank
  - Set left/right power
  - Set duration/degrees and flags
example_task: Left power 50, right power 30.
```

## Large Motor

```yaml
block_id: motor_large
block_name: Large Motor
category: robot
msg_key: LARGE_MOTOR
html_category: Common
html_label: "large motor"
html_match_fragments: ["large motor"]
type: statement
visual_signature: orange single motor block; power/time/degrees/brake/complete
function:
  summary: Controls one large motor.
  use_when:
    - move one motor
    - run motor B/C independently
  avoid_when:
    - two-motor movement → use move_tank
inputs:
  - motor/port if available
  - power
  - time
  - degrees
  - brake
  - complete
outputs: none
instruction_template:
  - Go to Robot
  - Drag Large Motor
  - Choose motor/port
  - Set power/time/degrees
example_task: Run motor B for 2 seconds.
```

## Unregulated Motor

```yaml
block_id: motor_unregulated
block_name: Unregulated Motor
category: robot
msg_key: UNREGULATED_MOTOR
html_category: Common
html_label: "unregulated motor"
html_match_fragments: ["unregulated motor"]
type: statement
visual_signature: orange single motor block; unregulated/open-loop power
function:
  summary: Controls motor without speed regulation.
  use_when:
    - torque/open-loop experiments
    - raw motor power
  avoid_when:
    - regulated movement → use motor_large
inputs:
  - motor/port
  - power
  - time
  - degrees
  - brake
  - complete
outputs: none
instruction_template:
  - Go to Robot
  - Drag Unregulated Motor
  - Choose motor
  - Set power and duration
example_task: Run unregulated motor at 30 power.
```

## Reset Robot

```yaml
block_id: robot_reset
block_name: Reset Robot
category: robot
msg_key: RESET_SENSOR
html_category: Common
html_label: "reset + All"
html_match_fragments: ["reset", "All"]
type: statement
visual_signature: orange reset robot block
function:
  summary: Resets robot sensors/state.
  use_when:
    - clear encoders/sensors
    - start measurement fresh
  avoid_when:
    - reset phone timer → use reset_timer
inputs:
  - none
outputs: none
instruction_template:
  - Go to Robot
  - Drag Reset Robot
  - Place before robot measurement
example_task: Reset robot before movement.
```

## Read Robot Sensor

```yaml
block_id: robot_sensor_read
block_name: Read Robot Sensor
category: robot
msg_key: READ_SENSOR
html_category: Common
html_label: "optical encoder"
html_match_fragments: ["optical encoder"]
type: value
visual_signature: orange robot sensor read block; sensor type selector
function:
  summary: Returns value from robot sensor.
  use_when:
    - read encoder/robot-side sensor
    - condition based on robot hardware
  avoid_when:
    - phone sensor → use Physical Sensors
inputs:
  - sensor_type
outputs: value
instruction_template:
  - Go to Robot
  - Drag Read Robot Sensor into value socket
  - Choose sensor type
example_task: Read motor encoder value.
```

## Servo 180

```yaml
block_id: servo_180
block_name: Servo 180
category: robot
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: statement
visual_signature: orange servo block; S1-S4 port and angle 0-180
function:
  summary: Sets servo angle from 0 to 180 degrees.
  use_when:
    - position servo to specific angle
    - robot mechanism control
  avoid_when:
    - continuous rotation servo → use servo_360
inputs:
  - port: S1/S2/S3/S4
  - angle: 0-180
outputs: none
instruction_template:
  - Go to Robot
  - Drag Servo 180
  - Choose port
  - Set angle
example_task: Set servo S1 to 90.
```

## Servo 360

```yaml
block_id: servo_360
block_name: Servo 360
category: robot
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: statement
visual_signature: orange continuous servo block; port, power, on/off
function:
  summary: Controls continuous rotation servo power.
  use_when:
    - spin servo continuously
    - open-loop servo movement
  avoid_when:
    - fixed angle servo → use servo_180
inputs:
  - port
  - power: -100 to 100
  - on_off
outputs: none
instruction_template:
  - Go to Robot
  - Drag Servo 360
  - Choose port
  - Set power
  - Set on/off
example_task: Spin S2 at 50 power.
```

## PID Controller

```yaml
block_id: pid_controller
block_name: PID Controller
category: robot
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: statement
visual_signature: orange PID block; kp/ki/kd/boost inputs
function:
  summary: Sets PID parameters for motor velocity control.
  use_when:
    - tune robot motor control
    - advanced motion accuracy
  avoid_when:
    - move robot directly → use movement blocks
inputs:
  - kp
  - ki
  - kd
  - boost
outputs: none
instruction_template:
  - Go to Robot
  - Drag PID Controller
  - Set kp, ki, kd, boost before movement
example_task: Set PID before moving straight.
```

## Set Robot Name

```yaml
block_id: set_robot_name
block_name: Set Robot Name
category: robot
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: statement
visual_signature: orange robot identity block; name input
function:
  summary: Assigns/selects robot identifier/name.
  use_when:
    - connect to specific robot
    - configure robot target
  avoid_when:
    - phone name → use Flow Control phone name if available
inputs:
  - name: string
outputs: none
instruction_template:
  - Go to Robot
  - Drag Set Robot Name
  - Enter robot name
example_task: Set robot name to AI_Robot_1.
```

## Uniform Acceleration Motion

```yaml
block_id: motion_accelerated
block_name: Uniform Acceleration Motion
category: robot
msg_key: null  # not present in current HTML flyout
html_category: null
html_label: null
type: statement
visual_signature: orange acceleration motion block; steering/a/time/v0/brake/complete
function:
  summary: Moves robot with constant acceleration motion.
  use_when:
    - accelerated motion experiment
    - physics kinematics
    - non-constant speed movement
  avoid_when:
    - constant velocity → use move_steering
inputs:
  - steering
  - acceleration
  - time
  - v0
  - brake
  - complete
outputs: none
instruction_template:
  - Go to Robot
  - Drag Uniform Acceleration Motion
  - Set steering, acceleration, time, v0, flags
example_task: Move with acceleration 10 for 5 sec.
```

# My Blocks / Macro Actions / Custom Blocks

Use this section when the user wants to define a reusable block or routine.

```yaml
block_id: custom_block_definition
block_name: My Block / User Routine
category: my_blocks
msg_key: MY_PROCEDURES_DEFNORETURN
html_category: My Blocks
html_label: "define block name"
type: custom container or callable routine
visual_signature: user-created block with custom name and optional parameters
function:
  summary: Groups several commands under one reusable name.
  use_when:
    - user says define a new block
    - user wants reusable routine
    - same sequence will be called multiple times
  avoid_when:
    - one-off simple program can stay inside on start
inputs:
  - custom parameters chosen by user
outputs: optional, depending on custom block design
instruction_template:
  - Go to My Blocks / Custom Blocks
  - Choose Make a Block / Create Routine
  - Name the block clearly
  - Add parameters only if values should change between calls
  - Build the internal command sequence inside the custom block definition
  - Call the custom block from on start or another flow
example_task: Define a block named UploadTestCSV that initializes storage, sets filename, and uploads CSV.
```

# LLM Validation Checklist

Before finalizing instructions, verify:

- Did every program start with `Start Program / on start` unless defining only a custom block?
- Are statement blocks placed in statement chains or containers?
- Are value blocks plugged into value sockets?
- Are loops used for repeated plotting/sampling?
- Are graph reset blocks placed before plotting loops?
- For trig plots, is `trig_function` fed degrees?
- If x-axis needs radians, is `math_expression x*3.1416/180` used for graph X?
- Are string comparisons done with `compare_strings`, not numeric compare?
- Are numeric comparisons done with `number_compare`, not string compare?
- Is MSB taken from `decimal_to_binary` bit3?
- Are storage operations preceded by `Initialize Storage`?
- Are Firebase DB operations preceded by `Initialize DB`?
