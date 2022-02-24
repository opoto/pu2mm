
var input = document.getElementById("input")
var output = document.getElementById("output")
var renderBtn = document.getElementById("render")
var convertBtn = document.getElementById("convert")
var focusBtn = document.getElementById("focus")
var info = document.getElementById("info")
document.getElementById("delete").onclick = () => {
  input.value =""
  output.innerHTML = ""
}

mermaid.initialize({
  // theme: 'forest',
  // themeCSS: '.node rect { fill: red; }',
  logLevel: 3,
  securityLevel: 'loose',
  sequence: { actorMargin: 50 },
  startOnLoad: false
})

function showError(err) {
  output.innerHTML = "<div class='error'>" + (err.str ? err.str.replace(/\n/g,"<br>") : err) + "</div>"
}

mermaid.parseError = showError
window.onerror = function(messageOrEvent, source, line, row, err) {
  let msg = messageOrEvent.toString()
  if (source) {
    msg += " [" + source + ":" + line + "," + row + "]"
  }
  showError(msg)
  if (err) {
    console.error(err)
  }
}

function showInfo(msg) {
  if (msg) {
    info.innerText = msg
    setTimeout(() => {
      info.innerText = ""
    }, 2000)
  } else {
    info.innerText = ""
  }
}

focusBtn.onclick = function() {
  for (const elt of document.getElementsByClassName("focus")) {
    elt.style.display = elt.style.display == "none" ? "" : "none"
  }
}

renderBtn.onclick = function() {
  try {
    if (mermaid.parse(input.value)) {
      mermaid.render('diagram', input.value, (svgCode) => {
        output.innerHTML = svgCode
      })
    }
  } catch (error) {
    showError(error)
  }
}

function replaceLine1(l, regex, by, modifier) {
  modifier = modifier || 'g'
  let re = new RegExp('\n([ \t]*)' + regex + '[ \t]*\n', modifier)
  l = l.replace(re, by)
  l = l.replace(re, by)
  return l
}

function replaceLine(v, re, by) {
  let res = ""
  for (l of v.split("\n")) {
    let indent = l.match(/^[ \t]+/);
    let trimmed = l.replace(/^[ \t]+/,"") // arrows with no label need a trailing space
    if (by != null) {
      // try to replace in line
      let patched = trimmed.replace(re, by)
      res += indent ? indent[0] + patched : patched
      res += "\n"
    } else {
      // matching line should be removed (commented out as "TBD")
      if (trimmed.search(re) >= 0) {
        res += "%% [TBD] "
      }
      res += l + "\n"
    }
  }
  return res
}

function replaceNotes(v) {
  let res = ""
  let lines = v.split("\n")
  let i = 0
  function searchWho(side) {
    let j = i-2
    while (j>0) {
      pl = lines[j--]
      let message = pl.match(/^\s*([^\s\-]+)\s*\-+\>+\s*([^\s:]+)\s*/)
      if (message) {
        return message[side.startsWith('left') ? 1 : 2]
      }
    }
  }
  function searchSingleLineNote(colon, txt) {
    if (colon) {
      return txt ? txt : ""
    }
    return undefined
  }
  while (i < lines.length ) {
    l = lines[i++]
    let indent = l.match(/^[ \t]+/);
    let trimmed = l.trim()
    let note
    if (trimmed.startsWith("note")) {
      let side, who
      let matches = trimmed.match(/^note\s+(left|right)\s*(:?)(.*)$/i)
      if (matches) {
        side = matches[1].toLowerCase() + " of"
        who = searchWho(side)
        note = searchSingleLineNote(matches[2], matches[3])
      } else {
        matches = trimmed.match(/^note\s+over\s*(\S+\s*,\s*\S+)\s*$/i)
        if (matches) {
          side = "over"
          who = matches[1]
        } else {
          matches = trimmed.match(/^note\s+(left|right)\s*of\s+(\S+)\s*$/i)
          if (matches) {
            side = matches[1].toLowerCase() + " of"
            who = matches[2]
          }
        }
      }
      if (typeof note == "undefined") {
        // multi line note
        let ended = false
        note = ""
        while (i < lines.length && !ended) {
          let ln = lines[i++]
          if (ln.search(/^\s*end\s*note\s*$/) >= 0) {
            ended = true
          } else {
            note += (note ? "<br>" : "") + ln.trim()
          }
        }
      }
      res += `${indent?indent[0]:""}note ${side} ${who}: ${note} \n`
    } else {
      previous = l
      res += l + "\n"
    }
  }
  return res
}

convertBtn.onclick = function() {
  let v = input.value

  if (v.search(/\s*sequenceDiagram/) >= 0) {
    showInfo("Source is already mermaid")
    return
  }
  // Start/end tags
  if(v.search(/@startuml/) >= 0) {
    v = v.replace(/@startuml/, "sequenceDiagram")
  } else {
    v = "sequenceDiagram\n" + v
  }
  v = v.replace(/@enduml/, "")
  // Line breaks
  v = v.replace(/\\n/g, "<br>")
  // Actor (stoplight does not support it)
  v = replaceLine(v, /^(actor)(\s+)(['"])(.*)(['"])/i, "participant$2👤<br><br>$4")
  // Participants
  v = replaceLine(v, /^(boundary|control|entity|database|collections|queue|participant)(\s+.*)/i, "participant$2")
  // .. remove participant's color
  v = replaceLine(v, /^participant\s+(.+)\s*[#\d\w]*\s*$/, "participant $1")
  // .. remove participant's order
  v = replaceLine(v, /^participant\s+(.+)\s*order\s.*$/, "participant $1")
  // .. without alias
  v = replaceLine(v, /^participant\s+(\S+)\s*$/, "MMD_participant $1")
  // .. with alias
  v = replaceLine(v, /^participant\s+\"?([^\"]+)\"?\s+as\s+(\S+)\s*[#\d\w]*$/, "MMD_participant $2 as $1")
  let participants = [], firstParticipant, lastParticipant
  let mmp = v.match(/MMD_participant[ \t]+(\w+)/g)
  if (mmp) {
    mmp.forEach( e => {
      let p = e.split(" ")[1]
      participants.push(p)
      firstParticipant = firstParticipant || p
      lastParticipant = p
    })
  } else {
    mmp = v.match(/\n[ \t]*(\w+)[ \t]*<*-+/g)
    if (mmp) {
      mmp.forEach( e => {
        let p = e.trim().split(" ")[0]
        if (participants.indexOf(p) < 0) {
          participants.push(p)
        }
        firstParticipant = participants[0]
        lastParticipant = participants[participants.length-1]
      })
    }
  }
  v = v.replace(/\bMMD_participant\b/g, "participant")
  // Participant boxes
  v = v.replace(/\n([ \t]*)end box[ \t]*\n/g, "\n$1%% endbox\n")
  v = v.replace(/\n([ \t]*)box/g, "\n$1%% box")
  // autonumber does not support parameters
  v = replaceLine(v, /^\s*autonumber\s.*/g, "autonumber")
  // Comments
  v = v.replace(/\n([ \t]*)'/g, "\n$1%%")
  // Arrows
  v = v.replace(/([ \t\w])(\-+)>>([ \t\w])/g, "$1$2)$3")
  v = v.replace(/([ \t\w])\-\>([ \t\w])/g, "$1->>$2")
  v = v.replace(/([ \t\w])(\-+)>([ \t\w])/g, "$1$2>>$3")
  v = v.replace(/([ \t\w])<(\-+)>([ \t\w])/g, "$1$2>$3")
  v = v.replace(/([ \t\w])(\w+)([ \t]*)<<(\-+)([ \t]*)(\w+)/g, "$1$6$3$4)$5$2")
  v = v.replace(/([ \t\w])(\w+)([ \t]*)<(\-+)([ \t]*)(\w+)/g, "$1$6$3$4>>$5$2")
  // Arrow without label
  v = v.replace(/([ \t]+)([\<\>\-\x]+)([ \t]*)(\w+)[ \t]*\n/g, " $2 $4: \n")
  // Notes
  v = replaceNotes(v)
  // return ??
  // Groups
  v = replaceLine(v, /^group[ \t]+(.*)$/g,
        `rect rgb(240,240,240)\n  note over ${firstParticipant},${lastParticipant}: $1`)
  // Divider
  v = replaceLine(v, /^==(.*)==([ \t])*$/g,
        `note over ${firstParticipant},${lastParticipant}: $1`)
  // Delay
  v = replaceLine(v, /^\.\.\.[ \t]*$/g,
    `note over ${firstParticipant},${lastParticipant}: ... later`)
    v = replaceLine(v, /^\.\.\.(.*)\.\.\.[ \t]*$/g,
    `note over ${firstParticipant},${lastParticipant}: ...$1`)
  // Space
  v = replaceLine(v, /^\|\|\|[ \t]*$/g, null)
  v = replaceLine(v, /^\|\|\d+\|\|[ \t]*$/g, null)
  // destroy
  v = replaceLine(v, /^destroy([ \t])/g, "deactivate$1")
  // [de]activation shortcuts?
  // Title
  v = replaceLine(v, /^title[ \t]+(.*)$/g,
      `note over ${firstParticipant}: $1`)
  // Unsupported features
  v = replaceLine(v, /^(header|footer|skinparam|newpage)\b.*$/g, null)


  input.value = v.replace(/\s*$/,"") + "\n"
  renderBtn.click()
}