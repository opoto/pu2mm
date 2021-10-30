
var input = document.getElementById("input")
var output = document.getElementById("output")
var renderBtn = document.getElementById("render")
var convertBtn = document.getElementById("convert")
var focusBtn = document.getElementById("focus")
var info = document.getElementById("info")

mermaid.initialize({
  // theme: 'forest',
  // themeCSS: '.node rect { fill: red; }',
  logLevel: 3,
  securityLevel: 'loose',
  sequence: { actorMargin: 50 },
  startOnLoad: false
})

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
  mermaid.render('whatisthis', input.value, function(svgCode) {
    output.innerHTML = svgCode
  })
}

mermaid.mermaidAPI.parseError = function(err, hash){
  output.innerHTML = "<div class='error'>" + err + ", " + hash + "</div>";
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
    l = l.trim()
    let patched = l.replace(re, by)
    res += indent ? indent[0] + patched : patched
    res += "\n"
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
  // skinning
  v = replaceLine(v, /skinparam\s.*$/, "")
  // Participants
  v = replaceLine(v, /(actor|boundary|control|entity|database|collections|queue|participant)(\s+.*)/, "participant$2")
  v = replaceLine(v, /^participant\s+(\S+)\s*[#\d\w]*$/, "MMD_participant $1")
  v = replaceLine(v, /^participant\s+(\S+)\s*order\s.*$/, "MMD_participant $1")
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
    mmp = v.match(/\n[ \t]+(\w+)[ \t]+<*-+/g)
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
  // Comments
  v = v.replace(/\n([ \t]*)'/g, "\n$1%%")
  // Arrows
  v = v.replace(/([ \t\w])(-+)>>([ \t\w])/g, "$1$2)$3")
  v = v.replace(/([ \t\w])->([ \t\w])/g, "$1->>$2")
  v = v.replace(/([ \t\w])(-+)>([ \t\w])/g, "$1$2>>$3")
  v = v.replace(/([ \t\w])<(-+)>([ \t\w])/g, "$1$2>$3")
  v = v.replace(/([ \t]*)(\w+)([ \t]*)<<(-+)([ \t]*)(\w+)/g, "$1$6$3$4)$5$2")
  v = v.replace(/([ \t]*)(\w+)([ \t]*)<(-+)([ \t]*)(\w+)/g, "$1$6$3$4>>$5$2")
  // return ??
  // Groups
  v = v.replace(/\n([ \t]*)group[ \t]+(.*)\n/g,
        "\n$1rect rgb(240,240,240)\n$1  note over " + firstParticipant + "," + lastParticipant + ": $2\n")
  // Notes TODO
  // Divider
  v = v.replace(/\n([ \t\w])*==(.*)==([ \t\w])*\n/g,
        "\n$1  note over " + firstParticipant + "," + lastParticipant + ": $2\n")
  // Delay
  v = replaceLine(v, /^\.\.\.[ \t]*$/g,
        "note over " + firstParticipant + "," + lastParticipant + ": ...")
  v = replaceLine(v, /^\.\.\.(.*)\.\.\.[ \t]*$/g,
        "note over " + firstParticipant + "," + lastParticipant + ": $1")
  // Space
  v = replaceLine(v, /^|||[ \t]*$/g, "")
  v = replaceLine(v, /^||\d+||[ \t]*$/g, "")
  // [de]activation
  v = replaceLine(v, /^(activate|deactivate|destroy)[ \t].*$/g, "")
  // [de]activation shortcuts?

  input.value = v.trim()
  renderBtn.click()
}