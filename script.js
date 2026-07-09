/* ==========================================================
   mike's terminal - script.js

   This got a little long but I tried to keep each section
   doing one job so it's easier to follow. Read top to bottom.
   ========================================================== */


/* ----------------------------------------------------------
   0. SETTINGS
   flip this to false if the beeping gets annoying
---------------------------------------------------------- */
let soundEnabled = false; // off by default, type "sound" to toggle it


/* ----------------------------------------------------------
   1. GRABBING THE DOM STUFF WE NEED
---------------------------------------------------------- */
const terminalBody = document.getElementById("terminalBody");
const inputLine = document.getElementById("inputLine");
const commandInput = document.getElementById("commandInput");
const promptText = document.getElementById("promptText");


/* ----------------------------------------------------------
   2. FAKE FILE SYSTEM
   super simple, just an object tree. each folder has a
   "files" list (just strings for flavor) and maybe some
   flavor text for when you cd into it.
---------------------------------------------------------- */
const fileSystem = {
  name: "~",
  path: "/home/mike/heart",
  children: {
    photos: {
      name: "photos",
      files: ["us_at_the_beach.jpg", "concert_night.png", "silly_faces.gif"],
      flavor: "a folder of moments that turned out better than expected."
    },
    memories: {
      name: "memories",
      files: ["first_date.txt", "road_trip.txt", "inside_jokes.txt"],
      flavor: "handle with care, some of these are still loading emotionally."
    },
    future: {
      name: "future",
      files: ["plans.txt", "someday.txt"],
      flavor: "still under construction, but it's looking really good so far."
    },
    music: {
      name: "music",
      files: ["mcr_playlist.txt", "guitar_riffs.mp3"],
      flavor: "mostly My Chemical Romance. no, this is not a phase."
    },
    slash: {
      name: "slash",
      files: ["slash.txt"],
      flavor: "the cat's directory. he does not share it willingly."
    }
  }
};

// tracks where we currently "are" in the fake filesystem
// null means we're at the root (~)
let currentFolder = null;


/* ----------------------------------------------------------
   3. CONTENT: fortunes, ascii art, help text, etc
   kept these near the top so they're easy to edit later
---------------------------------------------------------- */

const fortunes = [
  "You're allowed to have a good day for no reason.",
  "Somewhere, your cat is judging you affectionately.",
  "Small progress is still progress. Keep going.",
  "You are someone's favorite notification.",
  "Rest counts as productivity today.",
  "Your playlist has better taste than most people's entire personality.",
  "It's okay to not have it all figured out yet.",
  "Someone is proud of you and hasn't said it enough.",
  "Drink some water. Yes, right now.",
  "You make ordinary days a little less ordinary.",
  "The best conversations happen at 2am for a reason.",
  "You are doing better than you think you are.",
  "Slash approves of your life choices. Mostly.",
  "This too shall pass, probably while a good song is playing."
];

// simple ascii cat, nothing crazy, just enough to be cute
const catArt =
`  /\\_/\\
 ( o.o )
  > ^ <`;

// small welcome banner shown during boot, kept it simple
// so it doesn't break on narrow phone screens
const welcomeBanner =
`-------------------------------
       WELCOME, MIKE
-------------------------------`;

// lines that get typed out one at a time when the page first loads
const bootLines = [
  "Initializing kernel...",
  "Loading modules...",
  "Starting NetworkManager...",
  "Checking filesystem...",
  "Mounting /home/mike/heart...",
  "Starting slash-daemon (cat detected, purring at 60%)...",
  "Loading My Chemical Romance discography into memory...",
  "Almost there...",
  "Welcome, Mike."
];

// this gets filled in with the real date/time when boot runs
function getBootTimestamp() {
  const now = new Date();
  return now.toLocaleString();
}

// list of every command the user can actually run
// (used for the help command and for tab-complete)
const commandList = [
  "help", "about", "whoami", "fortune", "coffee", "love", "pwd",
  "ls", "cd", "cat", "mcr", "playlist", "neofetch", "history",
  "github", "sudo", "clear", "sound"
];


/* ----------------------------------------------------------
   4. OUTPUT HELPERS
   basically everything the terminal "prints" goes through
   these two functions
---------------------------------------------------------- */

// prints a plain line of text
function printLine(text, className) {
  const line = document.createElement("p");
  line.className = "term-line" + (className ? " " + className : "");
  line.textContent = text;
  terminalBody.appendChild(line);
  scrollToBottom();
}

// prints raw html, only used for stuff I control myself
// (ascii art, colored spans, that kind of thing)
function printHTML(html, className) {
  const line = document.createElement("p");
  line.className = "term-line" + (className ? " " + className : "");
  line.innerHTML = html;
  terminalBody.appendChild(line);
  scrollToBottom();
}

function scrollToBottom() {
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

// tiny helper for a fake delay, used a bunch below
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// very small beep, only plays if soundEnabled is true
// uses the Web Audio API so we don't need any sound files
function playBeep() {
  if (!soundEnabled) return;

  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = 220;
    gainNode.gain.value = 0.02; // keep it quiet, this isn't a game console

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
  } catch (err) {
    // if the browser blocks audio before user interaction, just ignore it
    console.log("audio not available yet:", err);
  }
}


/* ----------------------------------------------------------
   5. BOOT SEQUENCE
   typed out line by line, then hands control over to the
   real input once it's done
---------------------------------------------------------- */

async function runBootSequence() {
  printLine(`Boot started: ${getBootTimestamp()}`, "dim");
  await wait(400);

  for (const line of bootLines) {
    await typeLine(line);
    await wait(250);
  }

  await wait(300);
  printHTML(welcomeBanner.replace(/\n/g, "<br>"), "highlight");
  await wait(400);

  printLine('Type "help" to see what this thing can do.', "dim");

  // now that boot is done, show the real prompt and focus it
  inputLine.style.display = "flex";
  commandInput.focus();
}

// typing animation for a single line of boot text
// builds the line up character by character
function typeLine(text) {
  return new Promise(resolve => {
    const line = document.createElement("p");
    line.className = "term-line";
    terminalBody.appendChild(line);

    let i = 0;
    const speed = 18; // ms per character, felt about right

    const typer = setInterval(() => {
      line.textContent += text.charAt(i);
      i++;
      scrollToBottom();

      if (i >= text.length) {
        clearInterval(typer);
        resolve();
      }
    }, speed);
  });
}


/* ----------------------------------------------------------
   6. COMMAND HISTORY (up/down arrow support)
---------------------------------------------------------- */
let historyList = [];
let historyIndex = -1; // -1 means "not currently browsing history"

function addToHistory(cmd) {
  // don't bother saving empty enters or repeated duplicates in a row
  if (cmd.trim() === "") return;
  if (historyList[historyList.length - 1] === cmd) return;

  historyList.push(cmd);
  historyIndex = historyList.length; // reset pointer to "after the end"
}


/* ----------------------------------------------------------
   7. PROMPT PATH HELPER
   updates the little "mike@arch:~$" text based on
   whatever folder we're currently in
---------------------------------------------------------- */
function updatePrompt() {
  if (currentFolder) {
    promptText.textContent = `mike@arch:~/${currentFolder.name}$`;
  } else {
    promptText.textContent = "mike@arch:~$";
  }
}


/* ----------------------------------------------------------
   8. INDIVIDUAL COMMAND FUNCTIONS
   each command basically gets its own little function,
   easier to find things this way than one giant switch body
---------------------------------------------------------- */

function cmdHelp() {
  printLine("Available commands:");
  printLine("  help          - shows this list");
  printLine("  about         - what is this thing");
  printLine("  whoami        - guess");
  printLine("  fortune       - a small wholesome message");
  printLine("  coffee        - brews you a virtual coffee");
  printLine("  love          - do not run this at work");
  printLine("  pwd           - print working directory");
  printLine("  ls            - list what's in the current folder");
  printLine("  cd <folder>   - move into a folder (cd .. to go back)");
  printLine("  cat <file>    - read a file, if you can find one");
  printLine("  mcr           - now playing...");
  printLine("  playlist      - the music folder's contents");
  printLine("  neofetch      - fake system specs");
  printLine("  history       - past commands from this session");
  printLine("  github        - a totally real github link");
  printLine("  sudo hug      - requires elevated permissions");
  printLine("  clear         - clears the screen");
  printLine("  sound         - toggles beep sound effects on/off");
}

function cmdAbout() {
  printLine("You are the coolest Linux nerd I know.");
  printLine("This whole terminal exists because you deserved something weirder than a card.", "dim");
}

function cmdWhoami() {
  printLine("mike");
  printLine("status: favorite human. certified cool Linux nerd.", "dim");
}

function cmdFortune() {
  const pick = fortunes[Math.floor(Math.random() * fortunes.length)];
  printLine(pick, "highlight");
}

async function cmdCoffee() {
  printLine("brewing coffee...");
  let bar = "";

  for (let i = 0; i < 10; i++) {
    bar += "#";
    // re-render the same line by replacing the last printed one
    // easiest way here is to just print a fresh line and let it stack,
    // keeps the code simple even if it's not the "cleanest" way
    printLine("[" + bar.padEnd(10, "-") + "]", "dim");
    await wait(150);
  }

  printLine("Coffee's ready. Extra strong, just how you like it. ☕");
}

function cmdLove() {
  printLine("running love.sh...", "dim");
  printLine("Hey Mike. In case nobody's told you today:");
  printLine("you're loved more than the amount of time you spend debugging things at 1am.");
  printLine("that's a lot.", "highlight");
}

function cmdPwd() {
  if (currentFolder) {
    printLine(`${fileSystem.path}/${currentFolder.name}`);
  } else {
    printLine(fileSystem.path);
  }
}

function cmdLs() {
  if (currentFolder) {
    printLine(currentFolder.files.join("  "));
  } else {
    const folderNames = Object.keys(fileSystem.children).map(key => key + "/");
    printLine(folderNames.join("  "));
  }
}

function cmdCd(args) {
  const target = args[0];

  if (!target || target === "~") {
    currentFolder = null;
    updatePrompt();
    return;
  }

  if (target === "..") {
    if (currentFolder) {
      currentFolder = null;
      updatePrompt();
    } else {
      printLine("already at the top, nowhere else to go.", "dim");
    }
    return;
  }

  // strip a trailing slash if someone types "cd photos/"
  const cleanTarget = target.replace(/\/$/, "");
  const folder = fileSystem.children[cleanTarget];

  if (folder) {
    currentFolder = folder;
    updatePrompt();
    printLine(folder.flavor, "dim");
  } else {
    printLine(`cd: no such file or directory: ${target}`, "error-text");
  }
}

function cmdCat(args) {
  const fileName = args[0];

  if (!fileName) {
    printLine("cat: missing file operand", "error-text");
    return;
  }

  // slash.txt is a special case, works from anywhere
  if (fileName === "slash.txt") {
    printHTML(catArt.replace(/\n/g, "<br>"));
    printLine("Slash is currently supervising the system. Status: sleeping... probably.");
    return;
  }

  // otherwise check if the file exists in whatever folder we're in
  if (currentFolder && currentFolder.files.includes(fileName)) {
    printLine(`(${fileName} is mostly personal. use your imagination.)`, "dim");
  } else {
    printLine(`cat: ${fileName}: No such file or directory`, "error-text");
  }
}

async function cmdMcr() {
  printLine("Now playing: My Chemical Romance");
  await wait(300);

  const bars = "▁▂▃▄▅▆▇";
  let frames = 0;

  // little fake equalizer, just random bar heights for a bit
  const eq = setInterval(() => {
    let row = "";
    for (let i = 0; i < 12; i++) {
      row += bars.charAt(Math.floor(Math.random() * bars.length));
    }
    printLine(row, "highlight");
    frames++;

    if (frames >= 6) {
      clearInterval(eq);
      printLine("(you're humming it right now, aren't you)", "dim");
    }
  }, 200);
}

function cmdPlaylist() {
  printLine("music/mcr_playlist.txt");
  printLine("  1. Helena");
  printLine("  2. Welcome to the Black Parade");
  printLine("  3. Teenagers");
  printLine("  4. I'm Not Okay (I Promise)");
  printLine("  5. Na Na Na");
  printLine("(and about 40 more, let's be honest)", "dim");
}

function cmdNeofetch() {
  const specs =
`        /\\        mike@arch
       /  \\       ------------------
      /\\   \\      OS: Arch Linux (btw)
     /      \\     Host: Mike's Heart, Rev. 2
    /   ,,   \\    Kernel: 6.6-heart
   /   |  |   \\   Uptime: however long it takes to fall for someone
  /_-''    ''-_\\  Shell: bash (patience edition)
                  Terminal: mike@arch
                  CPU: overthinking x8
                  Memory: full, mostly of good stuff
                  Pets: slash (^..^)`;

  printHTML(specs.replace(/\n/g, "<br>"));
}

function cmdHistory() {
  if (historyList.length === 0) {
    printLine("no commands yet.", "dim");
    return;
  }
  historyList.forEach((cmd, index) => {
    printLine(`  ${index + 1}  ${cmd}`);
  });
}

function cmdGithub() {
  printLine("github.com/mike-loves-linux", "highlight");
  printLine("(mostly dotfiles and one repo he keeps rewriting)", "dim");
}

async function cmdSudo(args) {
  const sub = args.join(" ");

  if (sub === "hug") {
    printLine("[sudo] password for mike:");
    await wait(600);
    printLine("••••••••", "dim");
    await wait(400);
    printLine("Permission granted. Virtual hug delivered. (っ˘̩╭╮˘̩)っ", "highlight");
    return;
  }

  if (sub === "rm -rf /") {
    printLine("Nice try. Protected by Ghaida Security™.", "error-text");
    return;
  }

  printLine(`sudo: ${sub || "(no command given)"}: command not found`, "error-text");
}

function cmdSurprise() {
  printLine("initializing surprise.exe...", "dim");
  printLine("Mike, if you found this, you're clearly the type of person who");
  printLine("checks every corner of a thing instead of just skimming it.");
  printLine("That's kind of exactly why this got made in the first place -");
  printLine("you notice details, you care about the small stuff, and you");
  printLine("make the people around you feel like they matter.");
  printLine("So: thank you for being you. Slash agrees, probably.", "highlight");
}

function cmdSound() {
  soundEnabled = !soundEnabled;
  printLine(`sound effects: ${soundEnabled ? "on" : "off"}`, "dim");
}

function cmdClear() {
  terminalBody.innerHTML = "";
}


/* ----------------------------------------------------------
   9. MAIN COMMAND ROUTER
   takes the raw string typed by the user and figures out
   what to actually do with it
---------------------------------------------------------- */
function handleCommand(rawInput) {
  const trimmed = rawInput.trim();

  // always echo the command back like a real terminal would
  printLine(`${promptText.textContent} ${trimmed}`);

  if (trimmed === "") return;

  addToHistory(trimmed);

  const parts = trimmed.split(" ").filter(Boolean);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "help":
      cmdHelp();
      break;
    case "about":
      cmdAbout();
      break;
    case "whoami":
      cmdWhoami();
      break;
    case "fortune":
      cmdFortune();
      break;
    case "coffee":
      cmdCoffee();
      break;
    case "love":
      cmdLove();
      break;
    case "pwd":
      cmdPwd();
      break;
    case "ls":
      cmdLs();
      break;
    case "cd":
      cmdCd(args);
      break;
    case "cat":
      cmdCat(args);
      break;
    case "mcr":
      cmdMcr();
      break;
    case "playlist":
      cmdPlaylist();
      break;
    case "neofetch":
      cmdNeofetch();
      break;
    case "history":
      cmdHistory();
      break;
    case "github":
      cmdGithub();
      break;
    case "sudo":
      cmdSudo(args);
      break;
    case "surprise":
      cmdSurprise(); // not listed in help on purpose
      break;
    case "sound":
      cmdSound();
      break;
    case "clear":
      cmdClear();
      break;
    default:
      printLine(`command not found: ${cmd} (try "help")`, "error-text");
  }
}


/* ----------------------------------------------------------
   10. TAB AUTOCOMPLETE
   pretty basic version - finds commands that start with
   whatever's already typed
---------------------------------------------------------- */
function handleTabComplete() {
  const current = commandInput.value.trim();
  if (current === "") return;

  const matches = commandList.filter(c => c.startsWith(current));

  if (matches.length === 1) {
    commandInput.value = matches[0] + " ";
  } else if (matches.length > 1) {
    printLine(`${promptText.textContent} ${current}`);
    printLine(matches.join("  "), "dim");
  }
  // if there are no matches at all, just do nothing
}


/* ----------------------------------------------------------
   11. EVENT LISTENERS
   this is where keyboard input actually gets wired up
---------------------------------------------------------- */
commandInput.addEventListener("keydown", function (event) {

  if (event.key === "Enter") {
    playBeep();
    const value = commandInput.value;
    handleCommand(value);
    commandInput.value = "";
    historyIndex = historyList.length;
  }

  else if (event.key === "ArrowUp") {
    event.preventDefault(); // stop it from moving the cursor in the input
    if (historyList.length === 0) return;

    if (historyIndex > 0) {
      historyIndex--;
    }
    commandInput.value = historyList[historyIndex] || "";
  }

  else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (historyList.length === 0) return;

    if (historyIndex < historyList.length - 1) {
      historyIndex++;
      commandInput.value = historyList[historyIndex];
    } else {
      historyIndex = historyList.length;
      commandInput.value = "";
    }
  }

  else if (event.key === "Tab") {
    event.preventDefault(); // don't let the browser tab away from the input
    handleTabComplete();
  }
});

// clicking anywhere in the terminal refocuses the input,
// feels more like a real terminal that way
document.getElementById("terminal").addEventListener("click", function () {
  commandInput.focus();
});


/* ----------------------------------------------------------
   12. KICK EVERYTHING OFF
---------------------------------------------------------- */
runBootSequence();
