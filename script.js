document.addEventListener("DOMContentLoaded", preStart);
function preStart() {
    colorPage();
    const manager = getManager();
    if (manager.dataId) {
        try {
            getDBData(manager.dataId, () => saveManager(manager));
        } catch {
            alertInfo("Problem beim Laden des Accounts.");
        }
    }
    if (!manager.askAccount) pageAskAccount();
    else start();
}
function submitNewAccount() {
    const manager = getManager();
    addDBData(manager, (newDataId) => {
        manager.dataId = newDataId;
        saveManager(manager);
        downloadString(newDataId, "Schlüssel_PlanerAccount");
        start();
        setTimeout(() => alertInfo("Erfolgreich angemeldet!"), 3000);
        setTimeout(() => alertInfo("Schlüssel unbedingt aufbewahren!"), 3000);
    });
    start(); //to change site / avoid repitition
}
function submitLogInAccount() {
    const dataId = el("dataId").value;
    getDBData(dataId, (manager) => {
        if (!manager) return alertInfo("Account nicht gefunden.");
        saveManager(manager);
        start();
        setTimeout(() => alertInfo("Erfolgreich angemeldet!"), 3000);
    })
}
function start() {
    removeEvents();
    normalSortTasks();
    const isNewDay = dailyUpdate();
    if (isNewDay) {
        addObjectReminder(); //reminder daily from objects
        if (getDate().weekday == 5) downloadManager(); //every friday
        preStart();
        return;
    }; //prestart if new day
    setWatcher();
    const inPause = checkForInPause();
    if (checkForDoTask()) pageCheckTask();
    else if (inPause && checkForIntent()) pageShowIntent(); //only in pause
    else if (inPause && checkForNewIntent()) pageNewIntent();
    else if (inPause) pageInPause();
    else if (inPause == false) pageStopPause();
    else if (curEvents().length > 0) pageEvents();
    else if (checkForReminder()) pageShowReminder();
    else if (checkForProblemTasks()) pageProblemTasks();
    else if (checkForStartPause()) pageStartPause();
    else if (checkForShowPlan()) pageShowPlan();
    else if (checkForSleep()) pageSleeping()
    else if (checkForPrepare()) pageShowSleepTimes();
    else if (checkForQuest()) pageObjectQuest();
    else if (checkForPeopleMode()) pageViewObject();
    else pageListTasks();
}
function colorPage() {
    let colors = [
        "rgba(60, 160, 255,1)", //light blue
        "rgba(60, 210, 190, 1)", //turquoise
        "rgba(60, 200, 60, 1)", //green
        "rgba(110, 140, 190, 1)", //gray-blue
        "rgba(230, 220, 140, 1)", //beige
        "rgba(230, 210, 26, 1)", //yellow
        "rgba(230, 140, 0, 1)" //orange
    ];
    let color = colors[getDate().weekday - 1];
    document.documentElement.style.setProperty("--main-color", color);
}
function setWatcher() {
    let loginTime;
    const watcher = setInterval(() => {
        setHeight();
        setPosInt();
        let manager = getManager();
        let login = manager.lastLogIn || {};
        const time = login.time || 0;
        if (loginTime && time != loginTime) clearInterval(watcher); //other watcher active
        login.time = getTime();
        loginTime = login.time;
        manager.lastLogIn = login;
        saveManager(manager);
    }, 100);
}
function dailyUpdate() {
    addBirthdayTasks();
    let manager = getManager();
    let timeStamp = manager.lastLogIn || {};
    if (!timeStamp.date) timeStamp.date = { date: 0, month: 0, year: 0 };
    let isNewDay;
    if (!equalDate(timeStamp.date, getDate())) { //new day
        isNewDay = true;
        manager.askAccount = undefined;
        manager.pause = undefined;
        manager.currentTask = undefined;
        manager.showedPlan = undefined; //plan for next days
        manager.showedSleepTimes = undefined; //times to sleep
        manager.peopleMode = undefined;
        //old values
        manager.lastColorSet = undefined;
        manager.people = undefined;
        addObjectReminder();
    }
    let newTimeStamp = {
        time: getTime(),
        date: getDate()
    }
    manager.lastLogIn = newTimeStamp;
    saveManager(manager);
    return isNewDay;
}
function checkForStartPause() {
    const manager = getManager();
    const pause = manager.pause || {};
    if (getTodayTasks().length == 0) return false; //no tasks to interrupt
    return getPauseTime() > 5 * 60 && //pause longer than 5min
        getTimeBuffer() > 5 * 60 && //min 5 min time in plan
        getTime() > (pause.delayTime || 0); //not delayed
}
function checkForInPause() {
    const manager = getManager();
    const pause = manager.pause || {};
    if (!pause.startPauseTime) return null; //no pause
    if (getTimeBuffer() < 0) return false; //pause has  to be finished now
    const duration = getPauseTime();
    let pauseTime = pause.startPauseTime + duration; //deadline
    return getTime() < pauseTime; //whether pause is left
}
function checkForNewIntent() {
    if (getTimeBuffer() < 0) return false; //not enough time
    let skip = getManager().skipIntent || lastDate(getDate()); //other date
    if (equalDate(skip, getDate())) return false; //skipped once today
    const intents = getIntents();
    for (let index = 0; index < intents.length; index++) {
        const intent = intents[index]; //all last entries are stable
        if (lastEl(intent.values || []) != true) return false;
    }
    return true;
}
function checkForIntent() {
    return getTimeBuffer() > 0 && todayIntent() != null; //got time and any intent
}
function todayIntent() {
    const date = getDate();
    const intents = getIntents();
    let output;
    for (let index = 0; index < intents.length; index++) {
        const intent = intents[index];
        const isToday = !equalDate(intent.lastDate, date);
        if (intent.skipOnce && isToday) {
            intent.lastDate = cl(date); //manage skipping today
            intent.skipOnce = Boolean(rand());
        } else if (isToday //today not checked yet
            || intent.notSecured) { //last check was false
            output = index; //ask today
        }
    }
    saveIntents(intents);
    return output;
}
function getPauseTime() {
    const manager = getManager();
    const pause = manager.pause || {};
    const startPause = pause.startPauseTime || getTime();
    const deadline = todayDeadline(); //deadline of last task
    const workTime = todayWorkTime(); //amount of time of tasks
    const timeLeft = Math.max(0, deadline - startPause); //min 0
    const factor = 1 - workTime / timeLeft || 0; //amount of freetime in whole time
    const lastWorkTime = startPause - pause.startWorkTime || 0;
    const duration = Math.round(lastWorkTime * factor) || 0;
    return Math.max(0, Math.min(duration, 20 * 60));
}
function todayDeadline() {
    const tasks = getTodayTasks();
    const lastTask = lastEl(sortTasksByEnd(tasks)) || {};
    return lastTask.time || getTime(); //last end or 21:00
}
function todayWorkTime() {
    const tasks = getTodayTasks();
    let workTime = 0;
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        workTime += task.duration || 0;
    }
    return workTime; //return entire work
}
function startPause() {
    let manager = getManager();
    let pause = manager.pause || {};
    pause.startPauseTime = getTime();
    manager.pause = pause;
    saveManager(manager);
    start();
}
function delayPause() {
    let manager = getManager();
    let pause = manager.pause || {};
    pause.delayTime = getTime() + 10 * 60; //delay over in 10min
    manager.pause = pause;
    saveManager(manager);
    start();
}
function stopPause() {
    let manager = getManager();
    let pause = manager.pause || {};
    pause.startWorkTime = getTime(); //set for new pause
    pause.startPauseTime = undefined;
    manager.pause = pause;
    saveManager(manager);
    start();
}
function checkForStartPeopleMode() {
    return getTimeBuffer() > 3 * 60 * 60;
}
function checkForPeopleMode() {
    const manager = getManager();
    return getTimeBuffer() > 3 * 60 * 60 && manager.peopleMode;
}
function checkForQuest() {
    const manager = getManager();
    return Boolean(manager.quest) && checkForPeopleMode();
}
function checkForSleep() {
    if (getTodayTasks().length > 0) return false; //not finished yet
    if (!getManager().showedSleepTimes) return false; //not informed
    const sleepTime = getNightTimes().sleepTime;
    if (getTime() < sleepTime) return false; //too soon
    return true;
}
function checkForPrepare() {
    if (getTodayTasks().length > 0) return false; //not finished yet
    if (getManager().showedSleepTimes) return false; //showed already
    const remindTime = getNightTimes().remindTime;
    if (getTime() < remindTime) return false; //too soon
    return true;
}
function getNightTimes(time = getTime(), asStrings = false) {
    const dayTime = 24 * 60 * 60;
    time += getTimeBuffer();
    time = Math.min(time, dayTime * 34 / 24); //latest is 10:00
    time = Math.ceil(time / 60 / 60 * 4) * 60 * 60 / 4; //round to next 1/4 h
    const startTime = asStrings ? miniStr(time) : time; //(more than 24h is ok)
    time -= 60 * 60; //prepare time in morning
    const wakeUpTime = asStrings ? miniStr(time) : time;
    time -= 8 * 60 * 60;
    const sleepTime = asStrings ? miniStr(time) : time;
    time -= 60 * 60;
    const prepareTime = asStrings ? miniStr(time) : time;
    time -= 2 * 60 * 60;
    const remindTime = asStrings ? miniStr(time) : time;
    return {
        remindTime: remindTime,
        prepareTime: prepareTime,
        sleepTime: sleepTime,
        wakeUpTime: wakeUpTime,
        startTime: startTime
    };
    function miniStr(time) {
        if (time > dayTime)
            return "Morgen, " + timeToValue(time - dayTime);
        else if (time < 0)
            return "Gestern, " + timeToValue(dayTime - time);
        else return "Heute, " + timeToValue(time);
    }
}
function startPeopleMode() {
    let manager = getManager();
    manager.peopleMode = true;
    saveManager(manager);
    start();
}
function skipNewIntent() {
    let manager = getManager();
    manager.skipIntent = getDate();
    saveManager(manager);
    start();
}
function submitNewIntent() {
    const text = el("intent").value;
    const secIntent = el("secIntent").value;
    const intent = {
        intent: text,
        secIntent: secIntent,
        lastDate: getDate(),
        values: []
    }
    let feedback = intentFeedback(intent);
    if (feedback) alertInfo(feedback);
    else { //no problem
        let intents = getIntents();
        intents.push(intent);
        saveIntents(intents, true);
        start();
    }
}
function submitIntentChange(index) {
    let intents = getIntents();
    let intent = intents[index];
    if (!intent) return; //no intent found
    let secIntent = true;
    const value = !((el("value") || {}).innerText || "").toLowerCase().includes("nicht");
    let values = intent.values || [];
    if (!intent.notSecured) values.push(value); //first time: only adding
    else if (!value) {
        intents.splice(index, 1); //remove intent (secInt is false)
        secIntent = false;
    }
    if (lastEqualBools(values) >= 3) intents.splice(index, 1);
    intent.values = values;
    intent.lastDate = getDate(); //skip for this day (when any intent ok)
    intent.skipOnce = Boolean(rand());
    intent.notSecured = !value; //ask sec time for secIntent
    intents = mixArray(intents);
    saveIntents(intents, true);
    pageIntentInfo(intent, !secIntent);
}
function intentFeedback(intent) {
    if (!intent.intent) return "Gib dein Ziel ein.";
    if (!intent.secIntent) return "Du brauchst auch einen Sicherheitsziel.";
    return false;
}
function checkForProblemTasks() {
    let tasks = problemTasks().length;
    let manager = getManager();
    let saved = manager.problemTasks || 0;
    manager.problemTasks = Math.min(tasks, saved); //get used to current
    saveManager(manager);
    return tasks > saved;
}
function setProblemTasks() {
    let manager = getManager();
    manager.problemTasks = problemTasks().length;
    saveManager(manager);
    start();
}
function checkForDoTask() {
    let manager = getManager();
    let current = manager.currentTask || {};
    let index = indexById(current.id || ""); //try to find task
    return index != null && current.startTime;
}
function getTodayTasks(tasks, date) {
    tasks = tasks || getTasks();
    date = date || getDate();
    let collection = [];
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        if (isReminder(task)) continue; //reminder is no task
        if (equalDate(task.date, date)) collection.push(task);
    }
    return collection;
}
function similiarRate(string1, string2) {
    let rate1 = containRate(string1, string2);
    let rate2 = containRate(string2, string1);
    return (rate1 + rate2) / 2;
}
function containRate(biggerString, testString) {
    let stringLength = Math.min(testString.length, 3);
    let matches = 0;
    if (testString) {
        for (let index = 0; index <= testString.length - stringLength; index++) {
            const shortString = testString.slice(index, index + stringLength);
            if (biggerString.includes(shortString)) matches++;
        }
    }
    return matches / (testString.length - stringLength + 1);
}
function submitChangeTask(id) {
    const text = el("text").value;
    const duration = Number(el("duration").value) * 60 || undefined;
    const startActive = Boolean(el("start_date"));
    const startDate = startActive ? el("start_date").value : undefined;
    const startTime = startActive ? el("start_time").value : undefined;
    const date = el("date").value;
    const time = el("time").value;
    const repeat = Number(el("repeat").value);
    const weekDays = evalWeekDays("weekDays");
    const monthDays = evalMonthDays("monthDays");
    let tasks = getTasks();
    const index = indexById(id);
    let task = tasks[index];
    task.text = text; //change task data
    task.duration = duration;
    task.startDate = valueToDate(startDate);
    task.startTime = valueToTime(startTime);
    task.date = valueToDate(date);
    task.time = valueToTime(time);
    task.repeat = repeat;
    task.weekDays = weekDays;
    task.monthDays = monthDays;
    const feedback = taskFeedback(task);
    if (feedback) alertInfo(feedback);
    else {
        tasks[index] = task;
        saveTasks(tasks, true);
        pageViewTask(id);
    }
}
function chooseTask(id) {
    const taskId = "task_" + id;
    let buttons = [ //show plan
        {
            name: "Planen", onclick: () => {
                pageViewTask(id)
            }
        }
    ];
    const index = indexById(id);
    const task = getTasks()[index];
    const manager = getManager();
    if (!checkForDoTask() && !checkForInPause() && !isEvent(task))
        buttons.push({
            name: "Erledigen", onclick: () => {
                doTask(id);
            }
        });
    choose(taskId, "tasks", buttons);
}
function chooseSubTask(id, isAcitveEvent, mainId) {
    const taskId = "task_" + id;
    let buttons = [
        {
            name: "Kopieren", onclick: () => {
                copyTask(id);
                pageViewTask(id)
            }
        },
        { name: "Teilen", onclick: () => pageLinkTasks(id) },
        {
            name: "Löschen", onclick: () => {
                let tasks = getTasks();
                const conId = (findLinkedTasks(id)[0] || {}).id;
                tasks = deleteTask(id);
                if (conId) pageViewTask(conId);
                else start();
            }
        }
    ];
    if (mainId && mainId != id) { //is sub task
        buttons[1] = {
            name: "Trennen",
            onclick: () => separateTask(id, mainId)
        }
    }
    if (isAcitveEvent) {
        buttons = [{ //first breake
            name: "Abbrechen", onclick: () => {
                removeTask(id); //cancel event
                start();
            }
        }];
    }
    choose(taskId, "shinyTasks", buttons);
}
function choose(taskId, listId, buttons) {
    let taskEl = el(taskId);
    const isChoosen = Boolean(findEl(taskEl, "taskSettings"));
    removeEl("taskSettings");
    if (!isChoosen) { //choose if not choosen
        addEl(taskId, "div", "taskSettings", ["center"]);
        addButtons(buttons, "taskSettings");
    }
    let parent = el(listId);
    let tasks = parent.children;
    for (let index = 0; index < tasks.length; index++) { //set size of tasks
        let element = tasks[index];
        if (!element) break;
        let textEl = element.children[0];
        if (!textEl) break;
        element.style.height = textEl.scrollHeight + "px"; //starting height
        let height = textEl.scrollHeight; //new height
        let setsEl = element.children[1]; //appended settings
        if (setsEl) height += setsEl.scrollHeight;
        element.style.height = height + "px";
    }
}
function doTask(id) {
    let index = indexById(id);
    let tasks = getTasks();
    let task = tasks[index];
    let manager = getManager();
    if (typeof checkForInPause() == "boolean")
        alertInfo("Beende erst deine Pause, bevor du Aufgaben machst.");
    else if (checkForDoTask())
        alertInfo("Schließe erstmal die deine Aufgabe ab.");
    else {
        let current = manager.currentTask || {};
        current.id = task.id; //set task id
        current.startTime = getTime(); //and time
        manager.currentTask = current;
        let pause = manager.pause || {};
        if (!pause.startWorkTime) pause.startWorkTime = getTime();
        manager.pause = pause;
        saveManager(manager);
        pageDoTask(task.text);
    }
}
function checkTask() {
    let manager = getManager();
    let current = manager.currentTask || {};
    let id = current.id || "";
    const startTime = current.startTime;
    let tasks = getTasks();
    const index = indexById(id);
    const task = cl(tasks[index]); //note del task for lead next page
    tasks = removeTask(id, tasks, startTime);
    let returnId; //search for next task to view
    if (indexById(id, tasks) != null) returnId = id; //task still exists
    else if ((task.taskList || []).length) returnId = task.taskList[0]; //first link
    manager.tasks = tasks; //save tasks
    manager.currentTask = undefined; //finish doing task
    saveManager(manager);
    pageViewTask(returnId);
}
function repeatTask(task, taskStart) {
    if (!task.repeat) return null; //only if should repeat
    let newDur = getTime() - taskStart; //form new duration
    if (task.duration) newDur = (newDur + task.duration) / 2;
    newDur = Math.ceil(newDur / 60) * 60;
    task.duration = newDur || task.duration;
    let nxtDate = isEvent(task) ? task.date : getDate(); //events start at ending
    nxtDate = addDate(nxtDate, task.repeat);
    let maxRepeats = 1000;
    if (task.weekDays || task.monthDays) while (maxRepeats > 0) {
        maxRepeats--;
        let nxtWeekday = getDate().weekday
        nxtWeekday += dateDif(getDate(), nxtDate);
        nxtWeekday = ((nxtWeekday - 1) % 7); //as index
        if (task.weekDays && task.weekDays[nxtWeekday]) break; //correct date
        if (task.monthDays && task.monthDays[nxtDate.date - 1]) break;
        nxtDate = nextDate(nxtDate); //go one day on
    }
    if (task.startDate) {
        let taskDif = dateDif(task.startDate, task.date);
        task.startDate = nxtDate; //start of task
        task.date = addDate(task.startDate, taskDif); //deadline with duration
    } else { //no start date, but deadline date
        task.date = nxtDate;
    }
    return task;
}
function submitNewTask(id) {
    let text = (el("text") || {}).value;
    let duration = Number((el("duration") || {}).value);
    let startActive = Boolean(el("start_date"));
    let startDate = startActive ? valueToDate((el("start_date") || {}).value) : null;
    let startTime = startActive ? valueToTime((el("start_time") || {}).value) : null;
    let date = valueToDate((el("date") || {}).value);
    let time = valueToTime((el("time") || {}).value);
    let repeat = Number((el("repeat") || {}).value);
    let weekDays = evalWeekDays("weekDays");
    let monthDays = evalMonthDays("monthDays");
    let newTask = {
        id: generateId(),
        text: text,
        duration: duration ? duration * 60 : undefined,
        startDate: startDate ? startDate : undefined,
        startTime: startTime ? startTime : undefined,
        date: date,
        time: time,
        repeat: repeat,
        weekDays: weekDays || undefined,
        monthDays: monthDays || undefined,
        taskList: []
    };
    const feedback = taskFeedback(newTask);
    if (feedback) alertInfo(feedback);
    else {
        let tasks = getTasks();
        const prepareTask = isEvent(newTask) ? createPrepareTask(newTask) : null;
        if (prepareTask) {
            newTask.taskList.push(prepareTask.id); //connect
            tasks.push(prepareTask);
        }
        if (typeof id != "string") { //single task
            tasks.push(newTask);
        } else { //part of group
            if (prepareTask) //link prepare task
                connectTasks(id, prepareTask.id, true, false, tasks);
            tasks.push(newTask); //real task
            connectTasks(id, newTask.id, true, false, tasks);
        }
        saveTasks(tasks, true);
        if (prepareTask) pageEditTask(prepareTask.id);
        else pageViewTask(newTask.id);
    }
}
function taskFeedback(task) {
    if (!task.text) return "Wie soll deine Aufgabe heißen?";
    if (!task.date || !task.time) return "Zu wann soll die Aufgabe fertig sein?";
    if (task.duration > 12 * 60 * 60) return "Diese Dauer geht etwas zu lange. Lege lieber ein Event fest.";
    if (!task.repeat && task.weekDays) return "Die Wochentage sind nur eine Erweiterung der Wiederholung.";
    if (!task.repeat && task.monthDays) return "Die Datumstage sind nur eine Erweiterung der Wiederholung";
    return false; //no msg, all correct
}
function connectTasks(aimId, addId, grouping, newGroup, tasks) {
    tasks = tasks || getTasks();
    let goToTask = grouping == null && newGroup == null;
    if (grouping == null)
        grouping = ((el("grouping") || {}).innerText || "").includes("Gruppe");
    if (newGroup == null)
        newGroup = ((el("separateTask") || {}).innerText || "").includes("löschen");
    let addIndex = indexById(addId, tasks);
    if (addIndex == null) return;
    let addTask = tasks[addIndex];
    addTask.taskList = addTask.taskList || [];
    if (newGroup) addTask.taskList = []; //reset old group
    resortTaskLinks(tasks, false); //cut other tasks
    addTask.taskList.push(aimId); //link add with aim
    let aimIndex = indexById(aimId);
    if (aimIndex == null) return;
    let aimTask = tasks[aimIndex];
    if (grouping) //link add with aim group
        addTask.taskList = addTask.taskList.concat(aimTask.taskList);
    resortTaskLinks(tasks, true); //connect from other sites
    if (goToTask) {
        saveTasks(tasks, true);
        pageViewTask(aimId);
    } else return tasks;
}
function findLinkedTasks(id, alsoThisTask, tasks) {
    tasks = tasks || getTasks();
    const index = indexById(id, tasks);
    if (index == null) return [];
    const task = tasks[index];
    let taskList = cl(task.taskList) || [];
    if (alsoThisTask) taskList.push(task.id);
    for (let i = taskList.length - 1; i >= 0; i--) {
        const linkId = taskList[i];
        let index = indexById(linkId, tasks);
        let task = tasks[index];
        if (task) taskList[i] = task; //turn into object
        else taskList.splice(i, 1); //not found
    }
    return taskList;
}
function resortTaskLinks(tasks = getTasks(), refillLinks) {
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        let taskList = task.taskList || [];
        if (taskList.includes(task.id)) //remove own id
            taskList.splice(taskList.indexOf(task.id), 1);
        for (let index = taskList.length - 1; index >= 0; index--) {
            const conId = taskList[index];
            if (taskList.indexOf(conId) != index) //doubled connection id
                taskList.splice(index, 1);
        }
        for (let index = taskList.length - 1; index >= 0; index--) {
            const conId = taskList[index];
            const conIndex = indexById(conId, tasks);
            const conTask = tasks[conIndex];
            if (conTask == null) taskList.splice(index, 1); //task not found
            else {
                let conTaskList = conTask.taskList || [];
                if (!conTaskList.includes(task.id)) //no link on other site
                    if (refillLinks) conTaskList.push(task.id); //refill
                    else taskList.splice(index, 1); //remove at own
                conTask.taskList = conTaskList;
            }
        }
        task.taskList = taskList;
    }
}
function lastEqualBools(bools = []) {
    if (!bools) return true;
    const lastBool = lastEl(bools);
    let counter = 0;
    for (let index = bools.length - 1; index >= 0; index--) {
        const bool = bools[index];
        if (bool != lastBool) return counter; //finish when bool changes
        else counter++;
    }
    return counter;
}
function createPrepareTask(event) {
    return {
        id: event.id + ":p",
        text: "Vorbereitung: " + event.text,
        duration: Math.min(60 * 60, //max 1h or event time /10
            Math.round(timeDif(event.startDate, event.startTime, event.date, event.time) / 10)),
        date: addDate(event.startDate, 0), //independend date
        time: event.startTime,
        taskList: [event.id], //linked with event
        repeat: event.repeat ? event.repeat + dateDif(event.startDate, event.date) : 0,
        weekDays: event.weekDays,
        monthDays: event.monthDays
    }
}
function generateId(date, time) {
    date = date || getDate();
    time = time || getTime();
    return date.year + ":" + date.month + ":" + date.date + ":" + time;
}
function timeDif(date1, time1, date2, time2) { //time2 - time1
    let days = dateDif(date1, date2);
    return days * 24 * 60 * 60 + time2 - time1;
}
function getImportantTasks() { //most important
    const tasks = getTasks();
    while (isReminder(tasks[0])) tasks.shift(); //no reminder at start
    if (!tasks.length) return []; //safety
    const timeBuffer = getTimeBuffer();
    const date = tasks[0].date;
    let impTasks = [tasks[0]];
    for (let index = 1; index < tasks.length; index++) {
        const task = tasks[index];
        if (isReminder(task)) continue; //don't show reminder as task
        if (!equalDate(task.date, date)) break; //ignore next day
        let testTasks = cl(tasks); //test tasks
        testTasks.splice(index); //move task to start
        testTasks.unshift(task);
        let buffer = getTimeBuffer(testTasks); //buffer with exchanged tasks
        if (buffer >= timeBuffer / 2) impTasks.push(task);
        else break;
    }
    return impTasks.slice(0, 6);
}
function separateEvents(tasks) { //change also tasks
    let events = [];
    for (let index = tasks.length - 1; index >= 0; index--) {
        const task = tasks[index];
        if (isEvent(task)) {
            events.push(task); //move to events
            tasks.splice(index, 1);
        }
    }
    return events;
}
function getEventByTime(events, date, time) {
    date = date || getDate();
    time = time || getTime();
    for (let index = 0; index < events.length; index++) {
        const event = events[index];
        if (inTaskTime(event, date, time)) return event;
    }
    return null;
}
function inTaskTime(task, date, time) {
    let inStart = task.startDate ? timeDif(task.startDate, task.startTime, date, time) > 0 : true;
    let inEnd = timeDif(date, time, task.date, task.time) > 0;
    return inStart && inEnd;
}
function indexById(id, tasks, onlyTask) {
    tasks = tasks || getTasks();
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        if (task.id == id) return onlyTask ? task : index;
    }
}
function sortTasksByEnd(tasks) {
    tasks = tasks || getTasks();
    for (let amount = 0; amount < tasks.length; amount++) {
        let changed;
        for (let index = 0; index < tasks.length - 1; index++) {
            const preTask = tasks[index];
            const nxtTask = tasks[index + 1];
            if (timeDif(preTask.date, preTask.time, nxtTask.date, nxtTask.time) < 0) { //wrong order
                tasks[index] = nxtTask;
                tasks[index + 1] = preTask;
                changed = true;
            }
        }
        if (!changed) break; //nothing changed
    }
    return tasks;
}
function normalSortTasks() {
    let tasks = getTasks();
    const dayTime = 24 * 60 * 60;
    let date = getDate();
    let time = getTime();
    if (getTodayTasks().length == 0) { //skip day
        let buffer = getTimeBuffer();
        let lastTasks;
        do {
            time += buffer; //go further in time
            if (time > dayTime) { //next day
                date = nextDate(date);
                time -= dayTime;
            }
            tasks = sortTasks(tasks, time, date); //sort for better order
            lastTasks = cl(tasks);
            buffer = getTimeBuffer(tasks, false, time, date); //reset buffer
        } while (buffer > 0); //stop when buffer low
        saveTasks(lastTasks);
    } else sortTasks();
}
function sortTasks(tasks, curTime = getTime(), curDate = getDate()) {
    let save = !tasks; //don't save if is given job
    tasks = tasks || getTasks();
    let dayTasks = tasksInDays(tasks);
    if (!dayTasks.length) return tasks; //no tasks, do nothing
    let changes = 1000;
    for (let index = 0; index < dayTasks.length; index++) {
        const curTasks = dayTasks[index] || []; //every day
        const taskDist = 5; //max distance of tasks while changing
        for (let index1 = 0; index1 < curTasks.length; index1++) {
            for (let index2 = 0; index2 < curTasks.length; index2++) {
                if (index1 == index2 || //not move to same
                    Math.abs(index1 - index2) > taskDist) continue; //move not further than 3 tasks
                if (trySortTasks(curTasks, index1, index2, curTime, curDate)) {//if changes, go back
                    index1 = index2 = Math.max(0, Math.min(index1, index2) - taskDist);
                    changes--;
                    if (changes < 0) {
                        tasks = dayTasksInTasks(dayTasks);
                        if (save) saveTasks(tasks);
                        pageTooMuchWork();
                        return tasks;
                    }
                }
            }
        }
    }
    tasks = dayTasksInTasks(dayTasks);
    if (save) saveTasks(tasks);
    return tasks;
}
function pageTooMuchWork() {
    setHeader("Sehr viele Aufgaben...");
    addText("Es ist viel Arbeit, alle Aufgaben zu sortieren. " +
        "Drücke auf weiter, um die nächsten 1000 Änderungen vorzunehmen.");
    addButtons([{ name: "Weiter", onclick: start }]); //restart
}
function trySortTasks(tasks, index1, index2, curTime, curDate) {
    const oldBuffers = getTimeBuffer(tasks, true, curTime, curDate);
    const oldEvents = oldBuffers.events;
    const oldTasks = oldBuffers.tasks;
    if (index1 > index2) { //order doesnt matter
        exchangeElInArray(tasks, index1, index2);
        const changeBuffers = getTimeBuffer(tasks, true, curTime, curDate);
        const changeEvents = changeBuffers.events;
        const changeTasks = changeBuffers.tasks;
        let change = hasHighestNumber(changeEvents, oldEvents);
        if (change == null) change = hasHighestNumber(changeTasks, oldTasks);
        if (change) return true; //return if better
        exchangeElInArray(tasks, index2, index1); //change back
    }
    moveElInArray(tasks, index1, index2);
    const moveBuffers = getTimeBuffer(tasks, true, curTime, curDate);
    const moveEvents = moveBuffers.events;
    const moveTasks = moveBuffers.tasks;
    let move = hasHighestNumber(moveEvents, oldEvents);
    if (move == null) move = hasHighestNumber(moveTasks, oldTasks);
    if (move) return true; //return if better
    moveElInArray(tasks, index2, index1); //move back
    return false;
}
function tasksInDays(tasks) {
    const date = getDate();
    let dayTasks = [];
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        const dayDif = Math.max(0, dateDif(date, task.date)); //days to task
        let amount = 50;
        while (dayTasks[dayDif] == undefined && amount > 0) {
            amount--;
            dayTasks.push([]); //fill with arrays
        }
        let inList = dayTasks[Math.max(0, dayDif)] || []
        inList.push(task);
        dayTasks[Math.max(0, dayDif)] = inList;
    }
    return dayTasks;
}
function dayTasksInTasks(dayTasks) {
    let tasks = [];
    for (let index = 0; index < dayTasks.length; index++) {
        const oneDayTasks = dayTasks[index];
        tasks = tasks.concat(oneDayTasks);
    }
    for (let index = tasks.length - 1; index >= 0; index--) {
        const task = tasks[index];
        if (!task) tasks.splice(index, 1);
    }
    return tasks;
}
function getTimeBuffer(tasks = getTasks(), returnArrays = false, curTime = getTime(), curDate = getDate()) {
    let lowestBuffer = Infinity; //average or lowest
    let taskBuffers = [];
    let eventBuffers = [];
    walkTaskTimes(tasks, (task, taskBuffer, gapTime) => {
        if (isEvent(task) && taskBuffer < 0) eventBuffers.push(taskBuffer);
        taskBuffers.push(taskBuffer); //update values
        lowestBuffer = Math.min(lowestBuffer, taskBuffer + gapTime);
    }, curTime, curDate);
    eventBuffers = sortNumbers(eventBuffers).reverse();
    taskBuffers = sortNumbers(taskBuffers).reverse();
    let allBuffers = { events: eventBuffers, tasks: taskBuffers };
    if (returnArrays) return allBuffers;
    return lowestBuffer;
}
function walkTaskTimes(tasks = getTasks(), handler = () => { }, time = getTime(), date = getDate()) {
    const currentEvents = curEvents(tasks);
    let gapTime = 0; //lowest buffer makes sense
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        let taskBuffer = Infinity;
        if (isEvent(task)) {
            let startBuffer = timeDif(date, time, task.startDate, task.startTime); //time till event starts
            if (!currentEvents.includes(task.id)) //exception when is current event
                taskBuffer = startBuffer < 0 ? startBuffer : Infinity;
            if (startBuffer > 0) gapTime += startBuffer; //time to wait here
            if (timeDif(date, time, task.date, task.time) > 0) { //event is longer
                date = task.date; //take end time of event
                time = task.time;
            }
        } else { //normal task
            if (task.startDate) {
                let startBuffer = timeDif(date, time, task.startDate, task.startTime);
                if (startBuffer > 0) {
                    date = task.startDate; //wait till starts if necessary
                    time = task.startTime;
                    gapTime += startBuffer; //when waiting, lowest buffer is not important yet
                }
            }
            time += task.duration || 0;
            if (time > 24 * 60 * 60) {
                date = nextDate(date);
                time = task.duration;
            }
            if (!isReminder(task)) //reminder no time buffer
                taskBuffer = timeDif(date, time, task.date, task.time);
        }
        handler(task, taskBuffer, gapTime, time); //execute handler
    }
}
function hasHighestNumber(higherNumbers, testNumbers) {
    for (let index = 0; index < higherNumbers.length; index++) {
        const higher = higherNumbers[index];
        const test = testNumbers[index];
        if (higher > test) return true;
        if (test > higher) return false;
    }
    return null;
}
function problemTasks() {
    let problemTasks = [];
    let recentTasks = [];
    let gapTime = 0;
    walkTaskTimes(getTasks(), (task, taskBuffer, walkGapTime) => {
        if (gapTime != walkGapTime) { //when new gap in time table
            recentTasks = [];
            gapTime = walkGapTime;
        }
        recentTasks.push(task);
        if (taskBuffer < 0) {
            problemTasks = problemTasks.concat(recentTasks); //add whole task line
            recentTasks = [];
        }
    });
    return problemTasks;
}
function curEvents(tasks) {
    tasks = tasks || getTasks();
    const date = getDate();
    const time = getTime();
    let events = []; //as id
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        if (!isEvent(task)) continue; //no event
        else if (timeDif(task.startDate, task.startTime, date, time) <= 0) continue;
        else if (timeDif(date, time, task.date, task.time) <= 0) continue;
        else { //current event
            events.push(task.id);
        }
    }
    return events;
}
function isEvent(task) {
    return Boolean(!task.duration && task.startDate);
}
function getNextEvent() {
    const tasks = getTasks();
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        if (isEvent(task)) return task;
    }
}
function toEventTask(task) {
    if (!isEvent(task)) return task;
    return {
        text: task.text,
        date: task.startDate,
        time: task.startTime
    };
}
function removeEvents() {
    const date = getDate();
    const time = getTime();
    let tasks = getTasks();
    for (let index = tasks.length - 1; index >= 0; index--) {
        let task = tasks[index];
        if (isEvent(task) && timeDif(task.date, task.time, date, time) > 0) {
            tasks = removeTask(task.id, tasks);
        }
    }
}
function separateTask(id, mainId) {
    const tasks = getTasks()
    let task = indexById(id, tasks, true);
    if (!task) return;
    if (mainId) { //sep only main task
        const idIndex = task.taskList.indexOf(mainId);
        if (idIndex >= 0) task.taskList.splice(idIndex);
    } else task.taskList = []; //cut from this task
    resortTaskLinks(tasks, false); //cut from other tasks
    saveTasks(tasks, true);
    pageViewTask(id);
}
function copyTask(id, tasks = getTasks()) {
    const oldTask = indexById(id, tasks, true);
    const task = cl(indexById(id, tasks, true)); //copied task
    task.id = generateId(); //update id (is new task)
    task.taskList.push(oldTask.id); //connect with each other
    oldTask.taskList.push(task.id);
    tasks.push(task);
    saveTasks(tasks, true);
}
function removeTask(id, tasks, taskStart) {
    tasks = tasks || getTasks();
    const index = indexById(id, tasks);
    let task = tasks[index];
    const newTask = repeatTask(task, taskStart); //repeat
    if (newTask) tasks.push(newTask); //if is repeatable: add
    return deleteTask(id, tasks);
}
function deleteTask(id, tasks) {
    tasks = tasks || getTasks();
    const index = indexById(id, tasks);
    if (index == null) return tasks;
    tasks.splice(index, 1); //del
    resortTaskLinks(tasks, false); //cut recent connections
    saveTasks(tasks, true);
    return tasks;
}
function checkForReminder() {
    return Boolean(getRemindTask());
}
function ignoreReminder(id, tasks = getTasks()) {
    const task = indexById(id, tasks, true);
    if (!task) return;
    task.time = getTime() + 30 * 60; //add 30min
    saveTasks(tasks);
    start();
    setTimeout(() => alertInfo("Du wirst nach 30 Minuten nochmal erinnert."), 1000);
}
function getRemindTask(tasks = getTasks()) {
    const date = getDate();
    const time = getTime();
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        if (isReminder(task) && timeDif(task.date, task.time, date, time) > 0) return task;
    }
}
function isReminder(task) {
    if (!task) return false;
    return !task.duration && !task.startDate && task.date && task.time;
}
function checkForShowPlan() {
    const today = getTodayTasks();
    return !today.length && !getManager().showedPlan;
}
function getPlanTasks() {
    const tasks = getTasks();
    for (let index = tasks.length - 1; index >= 0; index--) {
        const task = tasks[index];
        if (task.repeat) tasks.splice(index, 1); //remove daily tasks
    }
    const dayTasks = tasksInDays(tasks);
    for (let index = 0; index < dayTasks.length; index++) {
        const tasksOfDay = dayTasks[index];
        while (tasksOfDay.length > 1) {
            const task0 = tasksOfDay[0]
            const title0 = task0.text;
            const isEvent0 = Number(isEvent(task0));
            const task1 = tasksOfDay[1];
            const title1 = task1.text;
            const isEvent1 = Number(isEvent(task1));
            if (isEvent0 > isEvent1 || //first is event
                (isEvent0 == isEvent1 && //or equal and
                    title0.length < title1.length)) //first is shorter
                tasksOfDay.splice(1, 1);
            else tasksOfDay.splice(0, 1);
        }
    }
    return dayTasksInTasks(dayTasks);
}
function getLinkTypes() {
    let types = [];
    const objects = getObjects();
    for (let index = 0; index < objects.length; index++) {
        const object = objects[index];
        let links = object.links || {};
        links = Object.keys(links); //array of keys = link types
        for (let index = 0; index < links.length; index++) {
            const type = links[index];
            if (!types.includes(type)) types.push(type);
        }
    }
    const impTypes = [ //always existing
        "Alter",
        "Geburtstag",
        "Geburtsjahr"
    ]
    for (let index = 0; index < impTypes.length; index++) {
        const impType = impTypes[index];
        if (!types.includes(impType)) types.push(impType);
    }
    return types;
}
function objectValueToText(object) {
    if (typeof object != "object") return "Objekt nicht erkannt.";
    const dataType = object.dataType || "Text";
    if (dataType.includes("Datum")) {
        return dateToString(object.value);
    }
    if (dataType == "Wahrheitswert") return object.value ? "Ja" : "Nein";
    if (object.value == null) return object.title; //view older version
    return String(object.value);
}
function objectByValue(value = "", dataType = "Text", objects = getObjects()) {
    if (dataType != "Text") return null; //only search for texts
    for (let index = 0; index < objects.length; index++) {
        const object = objects[index];
        object.value = object.value || object.title; //title for safety
        if (dataType == (object.dataType || "Text")) {
            if (dataType == "Text" || dataType == "Zahl" || dataType == "Wahrheitswert") {
                if (object.value == value) return object;
            } else if (dataType == "Datum" || dataType == "Reines Datum") {
                if (equalDate(object.value, value)) return object;
            }
        }
    }
}
function submitNewObject(id) {
    const objects = getObjects();
    const index = indexById(id, objects);
    const object = objects[index];
    if (!object) return alertInfo("Es gab einen Fehler bei deinem Objekt.");
    const type = el("type").value;
    const dataType = el("dataType").innerText || "Text";
    let value = readValueInput("data");
    if (!type) return alertInfo("Gib eine Kategorie ein.");
    if (value == null) return alertInfo("Der Wert wurde irgendwie nicht erkannt.");
    const linkObject = objectByValue(value, dataType, objects); //use objects as ref
    let linkId;
    if (linkObject) { //object already exists
        if (!linkObject.reversedLinks) linkObject.reversedLinks = [];
        linkObject.reversedLinks.push(object.id); //add as reversed
        linkId = linkObject.id;
    } else {
        let newObject = {
            id: generateId(),
            dataType: dataType,
            value: value,
            links: {},
            reversedLinks: [object.id] //link back to parent
        }
        linkId = newObject.id;
        objects.push(newObject);
    }
    let links = object.links[type] || []; //linked objects
    links.push(linkId); //link new
    object.links[type] = links;
    saveObjects(objects); //save in acc in updateBirth
    removeDoubleLinks();
    updateBirthsAges();
    pageViewObject(id);
}
function readValueInput(id = "data") {
    const typeEl = el(id + "Type");
    const dataType = typeEl.innerText;
    const element = el(id + "Value");
    let value;
    if (!element) { //is date without year
        value = {
            date: Number(el(id + "ValueDate").value),
            month: Number(el(id + "ValueMonth").value)
        }
    } else value = element.value || element.innerText;
    if (dataType == "Zahl") {
        value = Number(value)
        if (isNaN(value)) return alertInfo("Diese Zahl wurde nicht erkannt.");
    } else if (dataType == "Datum") value = valueToDate(value);
    else if (dataType == "Reines Datum") {
        if (!value.date) return alertInfo("Das Datum kann nicht gelesen werden.");
        if (!value.month) return alertInfo("Der Monat kann nicht gelesen werden.")
    } else if (dataType == "Wahrheitswert") {
        value = (value == "Wahr");
    }
    return value;
}
function questRand() {
    const manager = getManager();
    let objectId;
    let linkType;
    let max = 500;
    while (max > 0) {
        max--;
        const randObj = randEl(getObjects());
        if (!randObj.dataType || randObj.dataType == "Text") //only texts
            objectId = randObj.id;
        const posTypes = typicalLinks(objectId);
        if (posTypes.length) {
            linkType = randEl(posTypes);
            break;
        }
    }
    if (manager.quest) return; //has been set
    if (!linkType) return;
    manager.quest = {
        object: objectId,
        linkType: linkType
    }
    saveManager(manager);
    pageObjectQuest();
}
function removeQuestWaiter() {
    clearInterval(questWaiter);
    questWaiter = undefined;
}
function removeDoubleLinks(objects) {
    objects = objects || getObjects();
    for (let index = 0; index < objects.length; index++) {
        const object = objects[index];
        let linkTypes = object.links;
        Object.keys(linkTypes).forEach(type => {
            const links = linkTypes[type];
            for (let index = links.length - 1; index >= 0; index--) {
                const link = links[index]; //remove if doubled
                if (links.indexOf(link) != index) links.splice(index, 1);
            }
        });
        let revLinks = object.reversedLinks || [];
        for (let index = revLinks.length - 1; index >= 0; index--) {
            const revLink = revLinks[index];
            if (revLinks.indexOf(revLink) != index) //doubled link
                revLinks.splice(index, 1);
        }
    }
    saveObjects(objects); //save in acc at updateBirthAges
}
function removeEmptyLinks(objects) {
    objects = objects || getObjects();
    for (let index = 0; index < objects.length; index++) {
        const object = objects[index];
        let links = object.links || {};
        links = Object.entries(links);
        for (let index = 0; index < links.length; index++) {
            const linkList = links[index][1] || [];
            for (let index = linkList.length - 1; index >= 0; index--) {
                const linkId = linkList[index]; //try link
                const linkIndex = indexById(linkId, objects);
                if (linkIndex == null) linkList.splice(index, 1); //remove if empty
            }
            if (!linkList.length) links.splice(index, 1); //remove type of links
        }
        links = Object.fromEntries(links); //back to links
        object.links = links; //save normal links
        let revLinks = object.reversedLinks || []; //remove reversed links
        for (let index = revLinks.length - 1; index >= 0; index--) {
            const revLink = revLinks[index];
            const revIndex = indexById(revLink, objects);
            if (revIndex == null) revLinks.splice(index, 1); //link to nowhere
        }
    }
    saveObjects(objects, true);
    return objects;
}
function removeObject(id) {
    const objects = getObjects();
    const index = indexById(id, getObjects());
    if (index >= objects.length) return alertInfo("Fehler beim Löschen");
    const recallId = objects[index].reversedLinks[0];
    objects.splice(index, 1);
    removeEmptyLinks(objects); //and save
    pageViewObject(recallId);
}
function typicalLinks(objectId, objects) {
    objects = objects || getObjects();
    const object = indexById(objectId, objects, true);
    if (!object) return [];
    let reversedLinks = object.reversedLinks;
    let ownTypes = []; //that describe this
    for (let index = 0; index < reversedLinks.length; index++) {
        const revLink = reversedLinks[index];
        const revObject = indexById(revLink, objects, true); //object shows on this
        if (!revObject) continue;
        let revLinks = revObject.links; //where rev object shows on
        revLinks = Object.entries(revLinks);
        for (let index = 0; index < revLinks.length; index++) {
            const revType = revLinks[index][0];
            const revObjects = revLinks[index][1]; //ids of own objetcs
            if (revObjects.includes(object.id) && !ownTypes.includes(revType))
                ownTypes.push(revType);
        }
    }
    let typeObjects = []; //that have the same type like this
    for (let index = 0; index < ownTypes.length; index++) {
        const type = ownTypes[index];
        for (let index = 0; index < objects.length; index++) {
            const object = objects[index];
            let choosedObjects = object.links[type] || []; //links with same type
            for (let index = 0; index < choosedObjects.length; index++) {
                const object = choosedObjects[index];
                if (!typeObjects.includes(object)) typeObjects.push(object);
            }
        }
    }
    let types = [];
    for (let index = 0; index < typeObjects.length; index++) {
        const typeObject = indexById(typeObjects[index], objects, true);
        const lowerTypes = Object.keys(typeObject.links);
        lowerTypes.forEach(lowerType => {
            if (!types.includes(lowerType)) types.push(lowerType);
        });
    }
    return types;
}
function submitObjectQuest() {
    const manager = getManager();
    const quest = manager.quest || {};
    const objects = getObjects();
    const object = indexById(quest.object, objects, true);
    if (!object) return alertInfo("Objeckt nicht gefunden.");
    const links = object.links[quest.linkType] || [];
    const dataType = el("dataType").innerText;
    const value = readValueInput("data");
    const valueText = objectValueToText({
        value: value, //pretend being an object
        dataType: dataType
    });
    let rightId; //search for connection
    for (let index = 0; index < links.length; index++) {
        const link = links[index];
        const linkObject = indexById(link, objects, true);
        if (objectValueToText(linkObject) == valueText) //is same text
            rightId = linkObject.id;
    }
    if (rightId) {
        manager.quest = undefined; //delete quest
        saveManager(manager);
        pageViewObject(rightId);
        setTimeout(() => alertInfo("Richtig!"), 1000);
    } else { //not found any id
        pageNewObject(object.id); //add new object
        el("type").value = quest.linkType || ""; //insert infos
        setValueInput(value, dataType);
    }
}
function setValueInput(value, dataType) {
    for (let max = 10; max >= 0 && el("dataType").innerText != dataType; max--) {
        el("dataType").click(); //move to this datatype
    }
    if (dataType == "Text" || dataType == "Zahl") {
        el("value").value = value;
    } else if (dataType == "Datum") {
        el("value").value = dateToValue(value);
    } else if (dataType == "Reines Datum") {
        el("valueDate").value = value.date;
        el("valueMonth").value = value.month;
    } else if (dataType == "Wahrheitswert") {
        if (!value) el("value").click(); //turn to false
    }
}
function submitRenameObject(id) {
    const objects = getObjects();
    const object = indexById(id, objects, true);
    const dataType = el("dataType").innerText;
    const value = readValueInput("data");
    if (value == null) return alertInfo("Wert kann leider nicht erkannt werden... " +
        "Gib einfach etwas anderes ein.");
    if (typeof value == "string" && objectByValue(value)) //other equal text
        return alertInfo("Dieses Objekt gibt es leider schon.");
    object.dataType = dataType;
    object.value = value;
    saveObjects(objects, true);
    updateBirthsAges();
    pageViewObject(id);
}
function submitRenameLinkType(id = "me", linkType, allObjects = false) {
    const newLinkType = el("linkType").value;
    if (!newLinkType) alertInfo("Gib einen neuen Kategorie-Namen ein.");
    if (allObjects) {
        const objects = getObjects();
        for (let index = 0; index < objects.length; index++) {
            const object = objects[index];
            renameLinkType(object.id, linkType, newLinkType);
        }
    } else renameLinkType(id, linkType, newLinkType);
    pageViewObject(id);
}
function renameLinkType(id, oldLinkType, newLinkType) {
    const objects = getObjects();
    const object = indexById(id, objects, true);
    object.links[newLinkType] = cl(object.links[oldLinkType]); //copy content
    object.links[oldLinkType] = undefined; //remove old
    saveObjects(objects, true);
}
function deleteLinkType(linkType, id) {
    const objects = getObjects();
    const object = indexById(id, objects, true);
    object.links[linkType] = undefined; //remove this content
    removeEmptyLinks(objects); //remove at other sides & save
    pageViewObject(id); //reload
}
function levelUpObject(id, objects) {
    objects = objects || getObjects();
    const index = indexById(id, objects);
    if (index > 0) moveElInArray(objects, index, index - 1); //move in objects
    const object = indexById(id, objects, true);
    const revLinks = object.reversedLinks || [];
    for (let index = 0; index < revLinks.length; index++) {
        const revLink = revLinks[index];
        const revObject = indexById(revLink, objects, true); //object showing on him
        if (!revObject) continue;
        let revObjLinks = revObject.links || {};
        revObjLinks = Object.entries(revObjLinks);
        for (let index = 0; index < revObjLinks.length; index++) {
            let links = revObjLinks[index][1]; //links which could reach this
            let linkIndex = links.indexOf(object.id);
            if (linkIndex === 0) { //move whole type up
                if (index > 0) revObjLinks = moveElInArray(revObjLinks, index, index - 1);
            } else if (linkIndex > 0) { //move id in type up
                revObjLinks[index][1] = moveElInArray(links, linkIndex, linkIndex - 1);
            }
        }
        revObject.links = Object.fromEntries(revObjLinks); //save

    }
    saveObjects(objects);
    return objects;
}
function updateBirthsAges() {
    const objects = getObjects();
    for (let index = 0; index < objects.length; index++) {
        const object = objects[index];
        if (object.dataType && object.dataType != "Text") continue;
        const links = object.links || {};
        const birth = cl((indexById((links["Geburtstag"] || [])[0], //link / id
            objects, true) || {}).value); //value, no change
        if (!birth) continue; //birth date nessesary
        const birthYearObj = indexById((links["Geburtsjahr"] || [])[0], objects, true);
        const ageObject = indexById((links["Alter"] || [])[0], objects, true);
        const curDate = getDate();
        birth.year = curDate.year; //this year to compare
        let newObject = { //prepare new object
            id: generateId() + index,
            dataType: "Zahl",
            links: {},
            reversedLinks: [object.id]
        }
        let newLinkType;
        if (birthYearObj) { //prio birth year
            const birthYear = birthYearObj.value;
            let age = curDate.year - birthYear;
            if (isPastDate(curDate, birth)) age--; //last year not full
            if (ageObject) { //age already exists
                ageObject.value = age; //set age
                ageObject.dataType = "Zahl";
            } else { //no age exists
                newObject.value = age; //set new obj
                newLinkType = "Alter";
            }
        } else if (ageObject) { //else try age
            const age = ageObject.value;
            let birthYear = curDate.year - age;
            if (isPastDate(curDate, birth)) birthYear--;
            if (birthYearObj) {
                birthYearObj.value = birthYear;
                birthYearObj.dataType = "Zahl";
            } else {
                newObject.value = birthYear; //set new
                newLinkType = "Geburtsjahr";
            }
        }
        if (newLinkType) { //if new was set
            objects.push(newObject);
            object.links[newLinkType] = [newObject.id]; //reset data
        }
    }
    saveObjects(objects, true);
}
function addBirthdayTasks(objects = getObjects(), tasks = getTasks()) {
    for (let index = 0; index < objects.length; index++) {
        const object = objects[index];
        if (object.dataType != "Text") continue; //first search person
        const birthday = ((object.links || {})["Geburtstag"] || [])[0];
        if (!birthday) continue;
        const birthObj = indexById(birthday, objects, true);
        if (birthObj.dataType != "Reines Datum") continue;
        const birthDate = birthObj.value;
        birthDate.year = getDate().year; //set year
        if (isPastDate(birthDate, getDate())) //this year no birth
            birthDate.year++; //focus on next date
        if (dateDif(getDate(), birthDate) <= 28) {
            let allDone;
            for (let index = 0; index < tasks.length; index++) {
                const task = tasks[index];
                if (task.id.includes(object.value)) allDone = true;
            }
            if (!allDone) {
                const prepId = generateId() + ";birth_Prep:" + object.value;
                const eventId = generateId() + ";birth:" + object.value;
                const birthdayPrep = {
                    id: prepId,
                    text: object.value + " Geburtstag vorbereiten",
                    duration: 20 * 60,
                    date: getDate(),
                    time: 18 * 60 * 60,
                    repeat: 0,
                    taskList: [eventId]
                }
                const birthEvent = {
                    id: eventId,
                    text: object.value + " Geburtstag",
                    startDate: birthDate,
                    date: birthDate,
                    startTime: 12 * 60 * 60,
                    time: 18 * 60 * 60,
                    repeat: 0,
                    taskList: [prepId]
                };
                tasks.push(birthdayPrep);
                tasks.push(birthEvent);
            }
        }
    }
    saveTasks(tasks, true);
}
function addObjectReminder(objects = getObjects(), tasks = getTasks()) {
    for (let index = 0; index < objects.length; index++) {
        const object = objects[index];
        if (object.dataType != "Text") continue;
        const links = Object.entries(object.links || {}); //types of links
        for (let index = 0; index < links.length; index++) {
            const typedLinks = links[index][1]; //inner links
            for (let i = 0; i < typedLinks.length; i++) {
                const linkId = typedLinks[i];
                const linkObj = indexById(linkId, objects, true);
                if (!linkObj) continue;
                if (linkObj.dataType != "Reines Datum") continue;
                const date = linkObj.value;
                const curDate = getDate();
                date.year = curDate.year;
                if (isPastDate(date, curDate)) date.year++; //focus on next date
                const dif = dateDif(curDate, date); //from now to event in days
                if (dif > 0 && dif % 7 == 0 && dif <= 14) {
                    const task = {
                        id: generateId() + i + "," + index,
                        text: links[i][0] + " (" + object.value + ")",
                        date: getDate(),
                        time: Math.min(getTime() + 60 * 60, 22 * 60 * 60), //in 1h but latest 22:00
                        taskList: []
                    }
                    tasks.push(task);
                }
            }
        }
    }
    saveTasks(tasks, true);
}
function pageAskAccount() {
    const manager = getManager();
    manager.askAccount = true; //don't repeat this process
    saveManager(manager);
    if (manager.dataId) { //has account
        try {
            changeDBData(manager); //do data update
        } catch {
            alertInfo("Deine Daten konnten nicht auf der Datenbank " +
                "gespeichert werden.");
        }
        const time = getTime()
        let intro = "Guten Tag!";
        if (time < 12 * 60 * 60) intro = "Guten Morgen!";
        else if (time > 18 * 60 * 60) intro = "Guten Abend!";
        setHeader(intro);
        addText("Möchtest du auf deinem Account bleiben oder zu einem anderen wechseln?");
        addButtons([
            { name: "Wechseln", onclick: pageSwitchAccount },
            { name: "Hier bleiben", onclick: start }
        ]);
    } else { //no account yet
        setHeader("Account anlegen?");
        addText("Möchtest du dir einen Account anlegen? " +
            "Deine Daten können dann von allen Geräten mit dem Passwort abgerufen werden. " +
            "Auch sind sie nicht automatisch gelöscht, wenn du die Browserdaten löscht " +
            "(wie es ohne Account der Fall wäre).");
        addButtons([
            { name: "Neuer Account", onclick: pageSwitchAccount },
            { name: "Kein Account", onclick: start }
        ]);
    }
}
function pageSwitchAccount() {
    setHeader("Account wechseln");
    addText("Soll es ein völlig neuer Account sein oder möchtest du auf einen bekannten zugreifen?");
    addButtons([
        { name: "Neuer Account", onclick: pageNewAccount },
        { name: "Alter Account", onclick: pageLogInAccount }
    ]);
}
function pageNewAccount() {
    setHeader("Neuer Account?");
    addText("Bist du dir sicher, dass du einen neuen Account erstellen möchtest? " +
        "Er wird nach 300 Tagen, wenn keine Änderung vorgenommen wurde, wieder gelöscht.");
    addButtons([
        { name: "Abbrechen", onclick: start },
        { name: "Bestätigen", onclick: submitNewAccount }
    ])
}
function pageLogInAccount() {
    setHeader("Schlüssel eingeben");
    addText("Gib den Schlüssel deines gewünschten Accounts ein. " +
        "Er wurde dir bei der Erstellung deines Accounts als Text-Datei heruntergeladen.");
    addTextInput("dataId", "Account-Schlüssel");
    addButtons([
        { name: "Abbrechen", onclick: start },
        { name: "Bestätigen", onclick: submitLogInAccount }
    ]);
}
function pageWelcome() {
    setHeader("Herzlich Willkommen");
    addText("Es gibt aktuell keine Aufgaben. Welche könnte man hinzufügen?");
    addButtons([{
        name: "Neue Aufgabe", onclick: pageNewTask
    }]);
}
function pageStartPause() {
    setHeader("Pause starten");
    addText("Möchtest du jetzt oder später deine Pause starten?");
    addButtons([
        { name: "Pause starten", onclick: startPause },
        { name: "Später", onclick: delayPause }
    ]);
}
function pageInPause() {
    setHeader("Du hast Pause");
    const manager = getManager();
    const pause = manager.pause || {};
    addText("Hallo!", "timeShow");
    addButtons([
        { name: "Übersicht", onclick: pageListTasks },
        { name: "Pause beenden", onclick: stopPause }
    ]);
    const timeSet = setInterval(() => {
        let time = Math.min(pause.startPauseTime + getPauseTime() - getTime(), getTimeBuffer());
        time = Math.ceil(time / 60);
        if (time <= 0) start();
        time = time == 1 ? "Dir bleibt noch eine Minute" :
            "Dir bleiben noch " + time + " Minuten";
        let element = el("timeShow");
        if (element)
            element.innerText = time + " für deine Pause. Ruhe dich etwas aus.";
        else clearInterval(timeSet);
    }, 1000);
}
function pageStopPause() {
    setHeader("Pause vorbei");
    const taskAmount = getTodayTasks().length;
    let msg = "Beende sie, um die ";
    if (taskAmount == 1) msg += "letzte Aufgabe für heute zu erledigen";
    else msg += "restlichen " + taskAmount + " Aufgaben zu erledigen.";
    if (taskAmount == 0) msg = "Du bist dann fertig und kannst für den nächsten Tag vorarbeiten.";
    addText("Aufstehen! Deine Pause ist vorbei. " + msg, "pauseInfo");
    addButtons([{ name: "Pause beenden", onclick: stopPause }]);
}
function pageShowSleepTimes() {
    const manager = getManager();
    manager.showedSleepTimes = true;
    saveManager(manager); //don't ask again
    setHeader("Bald schlafen");
    addText("Gehe rechtzeitig ins Bett, " +
        "damit du morgen ausgeschlafen deine Aufgaben machen kannst.");
    const nightTimes = getNightTimes(getTime(), true);
    addSubHeader("Fertig machen", "Es ist dann Zeit, sich fertig zu machen. " +
        "Du hast dafür eine Stunde Zeit. Dann musst du schlafen");
    addText(nightTimes.prepareTime);
    addSubHeader("Schlafen", "Dann musst du schlafen.");
    addText(nightTimes.sleepTime);
    addSubHeader("Aufstehen", "Stelle deinen Wecker auf " +
        "spätestens diese Zeit ein. Du hast maximal eine Stunde.");
    addText(nightTimes.wakeUpTime);
    addSubHeader("Anfangen", "Nun kannst du mit deinen Aufgaben anfangen.");
    addText(nightTimes.startTime);
    addButtons([{ name: "Verstanden", onclick: start }]);
}
function pageSleeping() {
    setHeader("Nicht müde?");
    addText("Du solltest eigentlich schlafen... " +
        "Dann kommst du morgen besser aus dem Bett.");
    addButtons([{ name: "Ausnahme", onclick: pageListTasks }]);
}
function pageNewIntent() {
    setHeader("Neuer Vorsatz");
    addSubHeader("Vorsatz",
        "Beschreibe hier deinen Vorsatz, der für jeden Tag gelten kann -" +
        " nicht zu schwer und nicht zu leicht. " +
        "Ist der Vorsatz zu leicht oder zu schwer, wird er entfernt.");
    addTextInput("intent", "Vorsatz");
    addSubHeader("Sicherheitsvorsatz",
        "Gib hier deinen Sicherheitsvorsatz ein. Dieser sollte sehr leicht sein. " +
        "Sobald du deinen normalen Vorsatz nicht eingehalten hast, wird der Sicherheitsvorsatz abgefragt. " +
        "Wenn dieser auch nicht eingehalten wurde, wird der gesamte Vorsatz entfernt.");
    addTextInput("secIntent", "Sicherheitsvorsatz");
    addButtons([
        { name: "Ignorieren", onclick: skipNewIntent },
        { name: "Erstellen", onclick: submitNewIntent }
    ]);
}
function pageShowIntent() {
    const intents = getIntents();
    const index = todayIntent();
    const intent = intents[index];
    if (!intent) return pageListTasks(); //cancel when no intent
    if (intent.notSecured) return pageShowSecIntent(index); //ask sec time
    setHeader("Vorsatz");
    addSubHeader(intent.intent,
        "Zeit für einen Rückblick: " +
        "Hast du deinen Vorsatz gestern eingehalten - oder nicht?");
    addChooseInput("value", ["Vorsatz erreicht", "Nicht eingehalten"]);
    addButtons([
        { name: "Übersicht", onclick: pageListTasks },
        { name: "Bestätigen", onclick: () => submitIntentChange(index) }
    ]);
}
function pageShowSecIntent(index) {
    const intents = getIntents();
    const intent = intents[index];
    if (!intent) return pageListTasks(); //intent not found
    setHeader("Sicherheitsvorsatz");
    addSubHeader(intent.secIntent,
        "Sei ehrlich! Hast du den Sicherheitsvorsatz gestern eingehalten - oder nicht?");
    addChooseInput("value", ["Sicherheitsvorsatz erreicht", "Leider nicht eingehalten"]);
    addButtons([
        { name: "Bestätigen", onclick: () => submitIntentChange(index) }
    ])
}
function pageIntentInfo(intent, secIntentIsFalse) {
    const timesLeft = 3 - lastEqualBools(intent.values);
    let header = "";
    let text = "";
    if (timesLeft <= 0 || secIntentIsFalse) { //values or secIntent
        if (lastEl(intent.values)) {
            header = "Vorsatz geschafft!";
            text = "Gratulation! Du hast es geschafft, deinen Vorsatz drei Mal hintereinander " +
                "einzuhalten. Setze dir bei der nächsten Gelegenheit ein höheres Ziel.";
        } else {
            header = "Vorsatz gelöscht";
            if (secIntentIsFalse) text = "Leider hast du deinen Sicherheitsvorsatz nicht eingehalten, " +
                "was bedeutet, dass dein Vorsatz gelöscht wird. " +
                "Achte darauf, dass deine nächsten Vorsätze einen leichteren Sicherheitsvorsatz haben.";
            else //values are bad 
                text = "Leider hast du drei Mal hintereinander deinen Vorsatz nicht geschafft. " +
                    "Dadurch wird dieser nun gelöscht. Denke dir beim nächsten Mal einen leichteren Vorsatz aus.";
        }
    } else if (lastEl(intent.values)) { //last entry was true
        header = "Weiter so!";
        let times = timesLeft > 1 ? timesLeft : "ein";
        text = "Sehr gut! Du hast deinen Vorsatz eingehalten. " +
            "Halte ihn noch " + times + " mal ein, damit er abgeschlossen ist.";
    } else {
        header = "Nicht aufgeben!";
        let times = timesLeft > 1 ? timesLeft : "ein";
        text = "Gib Acht! Wenn du deinen Vorsatz noch " + times +
            " Mal nicht schaffst, wird er unwiderruflich gelöscht. " +
            "Es reicht, ihn einmal einzuhalten.";
    }
    setHeader(header);
    addSubHeader(intent.intent, "Das ist der Vorsatz, um den es geht." +
        '("' + intent.secIntent + '" ist der Sicherheitsvorsatz)');
    addText(text)
    addButtons([{ name: "Verstehe", onclick: start }]);
}
function pageEvents() {
    let eventIds = curEvents();
    let events = [];
    const tasks = getTasks();
    for (let idIndex = 0; idIndex < eventIds.length; idIndex++) {
        const eventId = eventIds[idIndex];
        const index = indexById(eventId);
        const event = tasks[index];
        events.push(event);
    }
    setHeader("Eventübersicht");
    let text = events.length == 1 ? "Ein Event ist" : "Einige Events sind";
    addText(text + " gerade aktiv.");
    addEditTasks(events, true);
    addButtons([
        { name: "Übersicht", onclick: pageListTasks },
    ]);
}
function pageNextEvent() {
    let event = getNextEvent();
    if (event == null) return start(); //only if next event exists
    setHeader("Nächstes Event");
    addSubHeader(event.text);
    let date = dateToString(event.startDate);
    let time = timeToValue(event.startTime);
    addText("Dieses Event ist für " + date + " um " + time + " angesetzt.");
    addButtons([{ name: "Alles klar", onclick: start }]);
}
function pageShowReminder() {
    const task = getRemindTask();
    if (!task) return pageListTasks();
    setHeader("Erinnerung");
    addText("Diese Erinnerung ist nun fällig. " +
        "Vernachlässige sie nicht.");
    addSubHeader(task.text)
    addButtons([
        {
            name: "Abhaken", onclick: () => {
                removeTask(task.id);
                start();
            }
        },
        { name: "Ignorieren", onclick: () => ignoreReminder(task.id) }
    ]);
}
function pageNewTask(id) {
    setHeader(typeof id == "string" ? "Neue Teilaufgabe" : "Neue Aufgabe anlegen");
    addSubHeader("Aufgabentext",
        "Gib einen Namen für deine Aufgabe ein. Du kannst ihn jederzeit ändern.");
    addTextInput("text", "Neue Aufgabe...");
    addSuggestion("text", getTasks(), null, pageViewTask);
    const timesBoxId = "timesContainer";
    const repeatBoxId = "repeatCont";
    addEl("main", "div", timesBoxId);
    addEl("main", "div", repeatBoxId);
    el("text").onblur = addTimes;
    function addTimes() {
        const titleEl = el("text") || {};
        if (!el("duration") && titleEl.value) { //not already added and title set
            addSubHeader("Dauer",
                "Diese Zahl beschreibt, " +
                "wie viele Minuten du für die Aufgabe brauchst, um sie zu erledigen. " +
                "Wenn eine Dauer für dich hier keinen Sinn macht, kannst du sie eventuell auch weglassen.",
                timesBoxId);
            addNumberInput("duration", timesBoxId);
            addSubHeader("Startzeit",
                "Gib hier den Zeitpunkt an, wann du frühestens loslegen möchtest. " +
                "Du kannst die Startzeit auch wieder löschen, falls du jederzeit starten kannst.",
                timesBoxId);
            addClosableTimeInput("start", false, () => {
                const date = valueToDate(el("start_date").value);
                el("start_date").addEventListener("blur", () => {
                    const newDate = valueToDate(el("start_date").value);
                    const dayDif = dateDif(date, newDate); //calc dif
                    let deadline = valueToDate(el("date").value);
                    if (dayDif > 0) deadline = addDate(deadline, dayDif);
                    else if (dayDif < 0) deadline = backDate(deadline, -dayDif);
                    el("date").value = dateToValue(deadline); //set dif
                }, { once: true });
            }, timesBoxId);
            addSubHeader("Frist",
                "Eine Frist muss immer gesetzt sein. Dann muss die Aufgabe fertig sein.",
                timesBoxId);
            addDateInput("date", timesBoxId);
            addTimeInput("time", timesBoxId);
            el("time").value = timeToValue(getTime() + 60 * 60);
            el("time").onblur = addRepeat;
            el("date").onblur = addRepeat;
            function addRepeat() {
                if (!el("repeat")) {
                    addSubHeader("Wiederholung",
                        "Wenn du möchtest, kannst du die Aufgabe sich wiederholen lassen, wenn du sie erledigt hast." +
                        "Die neue Frist (oder Startzeit) erscheint dann ein paar Tage später. " +
                        "Die Zahl gibt die Anzahl dieser Tage an.", repeatBoxId);
                    addNumberInput("repeat", repeatBoxId);
                    addCondRepeatSets(undefined, undefined, undefined,
                        repeatBoxId); //all sets initial
                }
            }
        }
    }
    let buttons = []; //back or submit
    if (typeof id == "string") buttons.push({ name: "Zurück", onclick: () => pageViewTask(id) });
    else buttons.push({ name: "Übersicht", onclick: pageListTasks });
    buttons.push({ name: "Fertig", onclick: () => submitNewTask(id) })
    addButtons(buttons);
}
function pageEditTask(id) {
    const index = indexById(id);
    const task = getTasks()[index];
    setHeader("Aufgabe bearbeiten");
    addSubHeader("Aufgabentext",
        "Ändere den Titel der Aufgabe, wenn du möchtest.");
    addTextInput("text", "Aufgabentext");
    addSubHeader("Dauer",
        "Ändere die Dauer der Aufgabe. " +
        "Bei Wiederholungsaufgaben wird sie immer ein wenig an die tatsächliche Dauer angepasst.");
    addNumberInput("duration");
    addSubHeader("Startzeit",
        "Ändere die Startzeit.");
    addClosableTimeInput("start", false, () => {
        const date = valueToDate(el("start_date").value);
        el("start_date").addEventListener("blur", () => {
            const newDate = valueToDate(el("start_date").value);
            const dayDif = dateDif(date, newDate); //calc dif
            let deadline = valueToDate(el("date").value);
            if (dayDif > 0) deadline = addDate(deadline, dayDif);
            else if (dayDif < 0) deadline = backDate(deadline, -dayDif);
            el("date").value = dateToValue(deadline); //set dif
        }, { once: true });
    });
    addSubHeader("Frist",
        "Ändere die Frist.");
    addDateInput("date");
    addTimeInput("time");
    addSubHeader("Wiederholung",
        "Ändere die Wiederholung (in Tagen), " +
        "falls du die Aufgabe häufiger oder weniger möchtest." +
        "Lege - wenn du möchtest - auch fest, an welchen Wochentagen " +
        "oder Datumstagen die Aufgabe wiederholt wird.");
    addNumberInput("repeat");
    addCondRepeatSets(); //nessecary sets are initial
    addButtons([
        {
            name: "Zurück", onclick: () => {
                setTimeout(pageViewTask(id), 0);
            }
        }, {
            name: "Fertig", onclick: () => {
                submitChangeTask(id);
            }
        }
    ]);
    el("text").value = task.text; //insert values
    el("duration").value = Math.round(task.duration / 60);
    if (task.startDate) {
        openInputs("start");
        el("start_date").value = dateToValue(task.startDate);
        el("start_time").value = timeToValue(task.startTime);
    }
    el("date").value = dateToValue(task.date);
    el("time").value = timeToValue(task.time);
    el("repeat").value = task.repeat || 0;
    if (task.repeat) {
        checkRepeatSets();
    }
    if (task.weekDays) {
        openWeekDays("weekDays");
        setWeekDays("weekDays", task.weekDays);
    }
    if (task.monthDays) {
        openMonthDays("monthDays");
        setMonthDays("monthDays", task.monthDays);
    }
}
function pageLinkTasks(id) {
    const tasks = getTasks();
    const index = indexById(id);
    const task = tasks[index];
    if (!task) return pageListTasks();
    setHeader("Teilen");
    addChooseInput("grouping",
        ["Ganze Gruppe der Zielaufgabe verbinden", "Nur die Zielaufgabe verbinden"]);
    addChooseInput("separateTask",
        ["Alte Verbindungen von " + task.text + " erhalten",
        "Alte Verbindungen von " + task.text + " löschen"]);
    addSubHeader("Zielaufgabe",
        "Gib den Aufgabentext (oder Titel) der Aufgabe ein, " +
        "mit der du " + task.text + " verbinden möchtest. " +
        "Du siehst dann die jeweils andere Aufgabe beim Planen.");
    addTextInput("text", "Aufgabe suchen");
    addSuggestion("text", getTasks(), null, connectTasks, [id]); //find other tasks
    addButtons([{ name: "Als eigene Aufgabe", onclick: () => separateTask(id) }]);
}
function pageListTasks() {
    removeQuestWaiter(); //when coming from people mode
    const tasks = getImportantTasks();
    if (tasks.length == 0) return pageWelcome();
    setHeader("Übersicht");
    addTaskList(tasks);
    let buttons = [{ name: "Neue Aufgabe", onclick: pageNewTask }];
    if (checkForDoTask()) //task is to do
        buttons.push({ name: "Zur Aufgabe", onclick: pageCheckTask });
    else if (curEvents().length > 0)
        buttons.push({ name: "Event ansehen", onclick: pageEvents });
    else if (typeof checkForInPause() == "boolean")
        buttons.push({ name: "Pause sehen", onclick: pageInPause });
    else if (checkForStartPeopleMode())
        buttons.push({ name: "Zu Leuten wechseln", onclick: startPeopleMode })
    addButtons(buttons);
    if (checkForPeopleMode()) addAutoReload();
}
function pageProblemTasks() {
    setHeader("Keine Zeit");
    addText("Einige Aufgaben können nicht rechtzeitig erledigt werden. " +
        "Möchtest du sie umplanen?");
    let tasks = problemTasks();
    addEditTasks(tasks, false);
    addButtons([
        { name: "Übersicht", onclick: pageListTasks },
        { name: "Nichts Ändern", onclick: setProblemTasks }
    ]);
}
function pageDoTask(text) {
    setHeader("Los geht's");
    addSubHeader(text);
    addText("Erledige deine Aufgabe!");
    addAutoReload();
}
function pageCheckTask() {
    const manager = getManager();
    const current = manager.currentTask || {};
    const startTime = current.startTime;
    const id = current.id;
    const index = indexById(id);
    const task = getTasks()[index];
    const duration = task.duration;
    const deviation = (getTime() - startTime) / duration;
    const text = task.text;
    let header;
    let pageText;
    if (deviation <= 0.8) {
        header = "Schon fertig?";
        pageText = "Du bist etwas schneller als gedacht. Hast du deine Aufgabe wirklich schon fertig?";
    }
    else if (deviation <= 1.2) {
        header = "Aufgabe beenden";
        pageText = "Möchtest du deine Aufgabe beenden?";
    }
    else {
        header = "Aufgabe endlich beenden";
        pageText = "Es hat etwas länger gedauert als gedacht. Bist du nun fertig mit deiner Aufgabe?";
    }
    setHeader(header);
    addSubHeader(text);
    addText("Wenn du fertig bist, kannst du deine Aufgabe beenden.");
    addButtons([
        { name: "Übersicht", onclick: pageListTasks },
        { name: "Aufgabe beenden", onclick: checkTask }
    ]);
    addAutoReload();
}
function pageViewTask(id) {
    const tasks = getTasks();
    let index = indexById(id);
    const task = tasks[index];
    if (!task) return start();
    setHeader("Planung");
    addSubHeader(task.text,
        "Du siehst jetzt alle Aufgaben, die mit dieser verbunden sind - " +
        "und auch die Aufgabe selbst.");
    addSubTasks(id);
    addButtons([
        { name: "Übersicht", onclick: start },
        {
            name: "Neue Teilaufgabe", onclick: () => {
                pageNewTask(id);
            }
        }
    ]);
}
function pageShowPlan() {
    const tasks = getPlanTasks();
    setHeader("Kommende Aufgaben");
    addText("Glückwunsch! Du hast es geschafft, " +
        "alle heutigen Aufgaben erfolgreich abzuschließen. " +
        "Diese Aufgaben erwarten dich in der Zukunft.");
    addEditTasks(tasks);
    addButtons([
        { name: "Alles klar", onclick: start }
    ]);
    const manager = getManager(); //do not show again
    manager.showedPlan = true;
    saveManager(manager);
}
function pageNewObject(id) {
    removeQuestWaiter();
    setHeader("Neuer Eintrag");
    addSubHeader("Kategorie");
    addTextInput("type", "Kategorie");
    addSuggestion("type", getLinkTypes());
    addValueInput("data");
    addButtons([
        { name: "Zurück", onclick: () => pageViewObject(id) },
        { name: "Fertig", onclick: () => submitNewObject(id) }
    ]);
}
function pageViewObject(id) {
    if (!questWaiter) questWaiter = setTimeout(questRand, 60 * 1000); //wait for quest
    let objects = getObjects();
    if (indexById("me", objects) == null) { //no me found
        objects.push({
            id: "me",
            title: "Ich selbst",
            links: {},
            reversedLinks: []
        });
        saveObjects(objects);
    }
    let index = indexById(id, getObjects());
    const object = objects[index];
    if (!object) return pageViewObject((objects[0] || {}).id || "me"); //retry
    if (!object.dataType) { //no type def (before update)
        object.dataType = "Text";
    }
    setHeader("Eintrag");
    addSubHeader(objectValueToText(object));
    addButtons([
        {
            name: "Umbenennen", onclick: () => pageRenameObject(object.id)
        },
        {
            name: "Löschen", onclick: () => removeObject(object.id)
        }
    ]);
    addLinks(object.links, id); //build page with links
    let buttons = [
        { name: "Zurück", onclick: () => pageGoBackObject(id) },
        {
            name: "Neuer Eintrag", onclick: () => pageNewObject(id)
        }
    ];
    if (object.id == objects[0].id) buttons[0] =
        { name: "Übersicht", onclick: pageListTasks };
    addButtons(buttons);
    if (rand()) levelUpObject(id);
}
function pageGoBackObject(id) {
    const objects = getObjects();
    const object = indexById(id, objects, true);
    if (!object) return pageViewObject();
    let revLinks = object.reversedLinks || [];
    if (revLinks.length <= 1)
        return pageViewObject(revLinks[0]);
    setHeader("Zurück");
    addEl("main", "div", "objects", ["object"]);
    addObjects(revLinks, "objects");
}
function pageRenameObject(id) {
    removeQuestWaiter();
    const objects = getObjects();
    const object = indexById(id, objects, true);
    if (!object) return alertInfo("Objekt nicht gefunden");
    setHeader("Umbenennen");
    addSubHeader(objectValueToText(object));
    addValueInput("data");
    addButtons([
        { name: "Abbrechen", onclick: () => pageViewObject(id) },
        { name: "Umbenennen", onclick: () => submitRenameObject(id) }
    ]);
}
function pageRenameLinkType(linkType, id) {
    setHeader("Kategorie ändern");
    addSubHeader(linkType, "Du kannst diese Kategorie umbenennen oder löschen. " +
        "Beim Umbenennen kannst du auch entscheiden, ob nur diese Kategorie oder jede, " +
        "die diesen Namen trägt, umbenannt wird.");
    addTextInput("linkType", "Umbenennen");
    const buttonSet = setInterval(() => {
        const linkTypeEl = el("linkType");
        if (!linkTypeEl) return clearInterval(buttonSet);
        const value = linkTypeEl.value;
        let buttons = [{ name: "Abbruch", onclick: () => pageViewObject(id) }];
        if (value) buttons.push(
            { name: "Einzeln", onclick: () => submitRenameLinkType(id, linkType, false) },
            { name: "Alle", onclick: () => submitRenameLinkType(id, linkType, true) }
        ); else buttons.push(
            { name: "Löschen", onclick: () => deleteLinkType(linkType, id) }
        )
        if (!el("button0") || Boolean(el("button2")) != Boolean(value)) {//only rename if value def
            removeEl("main4ButtonBox");
            addButtons(buttons); //change buttons
        }
    }, 10);
}
let questWaiter;
function pageObjectQuest() {
    removeQuestWaiter();
    const manager = getManager();
    const quest = manager.quest || {};
    if (!quest.linkType) { //not valid quest
        manager.quest = undefined;
        saveManager(manager);
        return questRand();
    }
    setHeader("Frage");
    const objects = getObjects();
    const object = indexById(quest.object, objects, true);
    if (!object) return pageViewObject();
    addSubHeader(objectValueToText(object), "Darum geht es.");
    addSubHeader(quest.linkType, "Diese Kategorie sollst du ausfüllen.");
    addValueInput("data");
    addButtons([
        { name: "Weiß nicht", onclick: () => pageViewObject(object.id) },
        { name: "Fertig", onclick: submitObjectQuest }
    ]);
}
function addAutoReload(handler = start) {
    addEl("main", "div", "autoReload");
    let reloadCounter = getTime();
    const reload = setInterval(() => {
        if (!el("autoReload")) clearInterval(reload); //changed site
        if (getTime() - reloadCounter > 2) { //off a few sec
            clearInterval(reload);
            handler();
        }
        else reloadCounter = getTime();
    }, 1000)
}
function addSuggestion(id, list = getTasks(), parentId = "main", onclick, args = []) {
    const sugBoxId = "suggestion_" + id + "_Box";
    const sugId = "sug_" + id;
    addEl(parentId, "div", sugBoxId, ["center"]);
    const suggestionMaker = setInterval(() => {
        if (!el(id) || !el(sugBoxId)) return clearInterval(suggestionMaker);
        const text = el(id).value;
        let matchId;
        let matchText;
        let matchRate = 0;
        for (let index = 0; index < list.length; index++) {
            const object = list[index];
            let title = typeof object == "string" ? object :
                (object.text || object.value || object.title || ""); //title is old version
            if (typeof title != "string") continue;
            const inRate = containRate(title, text) //contain more imp
                + similiarRate(title, text); //sim also important
            if (inRate > matchRate) { //set new match
                matchId = object.id;
                matchText = title;
                matchRate = inRate;
            }
            el(sugBoxId).innerHTML = ``; //reset suggestion
            if (matchRate > 0.7) {
                addEl(sugBoxId, "div", sugId, ["darkBox", "unanimate"], () => { //lead to task
                    if (!onclick) {
                        el(id).value = matchText; //set chosen text
                        el(id).disabled = true;
                    }
                    else if (matchId) onclick(matchId, ...args);
                }, [matchText]);
            }
        }
    }, 1000);
}
function setHeader(title) {
    closeMainInfo();
    el("main").innerHTML = ``; //reset page
    addEl("main", "div", "headerBox", ["center"]);
    addEl("headerBox", "h2", "header", [], null, [title]);
}
function addSubHeader(title, info, parentId = "main") {
    addEl(parentId, "div", "subHeader_" + title + "_Box", ["center"]);
    addEl("subHeader_" + title + "_Box", "h3", "subHeader_" + title, [], () => showHeaderInfos(title, info), [title]);
    addEl(parentId, "div", "headerInfoBox_" + title);
}
function showHeaderInfos(title, info) {
    if (!info) return;
    if (el("headerInfo_" + title)) el("headerInfoBox_" + title).innerHTML = ``;
    else {
        addText(info, "headerInfo_" + title, "headerInfoBox_" + title);
    }
}
function addText(text, id, parentId) {
    parentId = parentId || "main";
    if (!id) {
        id = "text" + el(parentId).children.length;
    }
    addEl(parentId, "div", id + "Box", ["center"]);
    addEl(id + "Box", "p", id, [], null, [text]);
}
function addTextInput(id, placeholder = "", parentId = "main", onclickHandler) {
    addEl(parentId, "div", id + "Box", ["center"]);
    addEl(id + "Box", "textarea", id, [], onclickHandler, [["rows", 1], ["placeholder", placeholder]]);
}
function addDateInput(id, parentId, noYear) {
    parentId = parentId || "main";
    addEl(parentId, "div", id + "Box", ["center"]);
    if (!noYear) {
        addEl(id + "Box", "input", id, [], null, [["type", "date"]]);
        setDate(id);
    } else {
        addEl(id + "Box", "input", id + "Date", ["small"], null, [["type", "number"]]);
        addEl(id + "Box", "input", id + "Month", ["small"], null, [["type", "number"]]);
        let dateEl = el(id + "Date");
        let monthEl = el(id + "Month");
        dateEl.value = getDate().date; //set manually
        monthEl.value = getDate().month;
        function setThisDate() {
            let date = dateEl.value;
            let month = monthEl.value;
            monthEl.value = month = Math.min(12, Math.max(1, month));
            const months = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            month = months[month - 1] || 0;
            dateEl.value = Math.min(month, Math.max(1, date));
        }
        dateEl.addEventListener("change", setThisDate);
        monthEl.addEventListener("change", setThisDate);
    }
}
function addNumberInput(id, parentId = "main") {
    addEl(parentId, "div", id + "Box", ["center"]);
    addEl(id + "Box", "input", id, ["posInt"], null, [["type", "number"]]);
}
function addValueInput(id = "data", parentId = "main") {
    addChooseInput(id + "Type", ["Text", "Zahl", "Datum", "Reines Datum", "Wahrheitswert"], parentId);
    const boxId = id + "ValueContainer";
    addEl(parentId, "div", boxId);
    function updateValue() {
        const dataType = el(id + "Type").innerText;
        el(boxId).innerHTML = ``; //reset content
        const valueId = id + "Value";
        if (dataType == "Text") {
            addSubHeader("Titel", "Benenne deinen neuen Eintrag passend.", boxId);
            addTextInput(valueId, "Titel", boxId);
            addSuggestion(valueId, getObjects(), boxId);
        } else if (dataType == "Zahl") {
            addSubHeader("Zahl", "Gib eine bestimmte Zahl an. " +
                "Praktisch für eine Anzahl oder ein Alter.", boxId);
            addNumberInput(valueId, boxId,);
        } else if (dataType == "Datum") {
            addSubHeader("Datum", "Gib ein bestimmtes Datum an.", boxId);
            addDateInput(valueId, boxId);
        } else if (dataType == "Reines Datum") {
            addSubHeader("Datum ohne Jahr", "Gib einen Tag im Jahr an. " +
                "Hilfreich für Geburtstage und Ähnliches", boxId);
            addDateInput(valueId, boxId, true); //no year
        } else if (dataType == "Wahrheitswert") {
            addSubHeader("Wahr - Falsch", "Dieser Wert ist entweder wahr - oder falsch.", boxId);
            addChooseInput(valueId, ["Wahr", "Falsch"], boxId);
        }
    }
    updateValue();
    el(id + "Type").addEventListener("click", updateValue);
}
function addChooseInput(id, list, parentId) {
    parentId = parentId || "main";
    if (typeof list != "object" || list.length == 0) return;
    const boxId = id + "Box"
    addEl(parentId, "div", boxId, ["center"]);
    addEl(boxId, "p", id, ["bordered", "bold"], () => changeChoose(id, list), [list[0]]);
}
function changeChoose(id, list) {
    let element = el(id);
    let value = element.innerText;
    let index = list.indexOf(value);
    index++;
    if (index >= list.length) index = 0;
    value = list[index];
    element.innerText = value;
}
function addReversableNumberInput(id, parentId) {
    parentId = parentId || "main";
    addEl(parentId, "div", id + "Box", ["center"]);
    addEl(id + "Box", "div", id + "Sign", ["circle", "center", "middle"], null, ["+"]);
    addEl(id + "Box", "input", id, ["posInt"], null, [["type", "number"]]);
}
function addTimeInput(id, parentId) {
    parentId = parentId || "main";
    addEl(parentId, "div", id + "Box", ["center"]);
    addEl(id + "Box", "input", id, [], null, [["type", "time"]]);
    setTime(id);
}
function addTimeShow(timeId) {
    let pauseText = " Minuten Pause stehen dir bei dieser Zeit zur Verfügung." +
        " Wenn du mehr Zeit haben möchtest, setzte einen späteren Zeitpunkt.";
    addText("0" + pauseText, "pauseDuration");
    const timeWriter = setInterval(() => {
        let time = el(timeId); //look for elements
        if (!time) clearInterval(timeWriter);
        else {
            time = time.value; //get value
            time = valueToTime(time);
            let output;
            if (time) {
                const curTime = getTime();
                let duration = (time - curTime) / 5; //time dif
                const maxTime = getTimeBuffer();
                const overTimed = duration > maxTime;
                duration = Math.max(0, Math.min(duration, maxTime));
                duration = Math.round(duration / 60);
                if (overTimed) pauseText =
                    " Minuten Pause stehen dir bei dieser Zeit zur Verfügung. " +
                    "Leider ist nicht mehr Zeit für eine längere Pause.";
                output = duration + pauseText;
                if (duration == 0) output = "Du hast leider keine Zeit für eine Pause. " +
                    "Erledige lieber alle Aufgaben, damit du sie wieder einplanen kannst.";
            } else output = "Gib eine Uhrzeit ein.";
            el("pauseDuration").innerText = output;
        }
    }, 100);
}
function addClosableTimeInput(id, onlyDate, onclickHandler, parentId = "main") {
    addEl(parentId, "div", id);
    closeInputs(id, onlyDate, onclickHandler);
}
function openInputs(id, onlyDate, onclickHandler) {
    el(id).innerHTML = ``;
    addDateInput(id + "_date", id);
    el(id + "_date").addEventListener("click", onclickHandler);
    if (!onlyDate) addTimeInput(id + "_time", id);
    addButtons([
        {
            name: "Startpunkt löschen", onclick: () => {
                closeInputs(id, onlyDate, onclickHandler);
            }
        }
    ], id);
}
function closeInputs(id, onlyDate, onclickHandler) {
    el(id).innerHTML = ``;
    addButtons([
        { name: "Startpunkt festlegen", onclick: () => openInputs(id, onlyDate, onclickHandler) }
    ], id);
}
function addCondRepeatSets(repeatId = "repeat",
    weekId = "weekDays", monthId = "monthDays", parentId = "main") {
    const optionId = weekId + monthId + "Option";
    addEl(parentId, "div", optionId);
    if (el(repeatId)) el(repeatId).onblur =
        () => checkRepeatSets(repeatId, weekId, monthId);
}
function checkRepeatSets(repeatId = "repeat", weekId = "weekDays", monthId = "monthDays") {
    const optionId = weekId + monthId + "Option";
    const repeat = Number(el(repeatId).value);
    if (!el(weekId) && repeat) { //should add
        addWeekDays(weekId, optionId);
        addMonthDays(monthId, optionId);
    } else if (el(weekId) && !repeat) { //should remove
        removeEl(weekId);
        removeEl(monthId);
    }
}
function addWeekDays(id, parentId) {
    parentId = parentId || "main";
    addEl(parentId, "div", id);
    closeWeekDays(id);
}
function closeWeekDays(id) {
    el(id).innerHTML = ``;
    addButtons([{ name: "Wochentage setzen", onclick: () => openWeekDays(id) }], id);
}
function openWeekDays(id) {
    if (el(id)) el(id).innerHTML = ``;
    else addEl("main", "div", id);
    const listId = id + "ChooseList"
    addEl(id, "div", listId, ["ordered"]);
    let days = weekdays();
    for (let index = 0; index < days.length; index++) {
        const day = days[index];
        const dayId = id + "DayCirc" + index;
        addEl(listId, "div", dayId, ["circle", "center", "middle", "red"],
            () => changeColor(dayId), [day]);
    }
    addButtons([{ name: "Wochentage löschen", onclick: () => closeWeekDays(id) }], id);
}
function setWeekDays(id, weekDays) {
    for (let index = 0; index < weekDays.length; index++) {
        const weekday = weekDays[index]; //is bool
        colorEl(id + "DayCirc" + index, weekday);
    }
}
function evalWeekDays(id) {
    if (!el(id + "ChooseList")) return null; //no weekday setting
    let weekBools = [];
    for (let index = 0; index < 7; index++) {
        const element = el(id + "DayCirc" + index);
        weekBools.push(element.classList.contains("green"));
    }
    if (lastEqualBools(weekBools) == 7) return null; //no valid setting
    return weekBools;
}
function addMonthDays(id, parentId) {
    parentId = parentId || "main";
    addEl(parentId, "div", id);
    closeMonthDays(id);
}
function closeMonthDays(id) {
    el(id).innerHTML = ``;
    addButtons([{ name: "Monatstage zeigen", onclick: () => openMonthDays(id) }], id);
}
function openMonthDays(id) {
    el(id).innerHTML = ``;
    addEl(id, "div", id + "Days");
    for (let rows = 0; rows < 4; rows++) {
        const rowId = id + "Row" + rows;
        addEl(id + "Days", "div", rowId, ["ordered", "blockMargin"]);
        for (let number = rows * 8; number < (rows + 1) * 8; number++) {
            const dayId = id + "Day" + number;
            addEl(rowId, "div", dayId, ["center", "middle", "circle", "red"],
                () => changeColor(dayId), [number + 1]);
        }
    }
    addButtons([
        { name: "Monatstage löschen", onclick: () => closeMonthDays(id) }
    ], id);
}
function setMonthDays(id, monthDays) {
    if (!monthDays) return;
    let dayList = el(id + "Days");
    if (!dayList) return;
    for (let index = 0; index < monthDays.length; index++) {
        const monthDay = monthDays[index]; // is bool
        colorEl(id + "Day" + index, monthDay);
    }
}
function evalMonthDays(id) {
    let monthDays = [];
    if (!el(id + "Days")) return null;
    for (let number = 0; number < 32; number++) {
        const dayId = id + "Day" + number;
        monthDays.push(el(dayId).classList.contains("green"));
    }
    if (lastEqualBools(monthDays) == monthDays.length) return null;
    return monthDays;
}
function changeColor(id) {
    let element = el(id);
    if (!element) return;
    colorEl(id, element.classList.contains("red"));
}
function colorEl(id, bool) {
    let element = el(id);
    if (!element) return;
    if (bool) { //change color
        element.classList.remove("red");
        element.classList.add("green");
    } else { //is green
        element.classList.remove("green");
        element.classList.add("red");
    }
}
function addButtons(buttonsList, parentId) {
    let parent = el(parentId);
    if (!parent) parentId = "main"; //no parent found
    parent = el(parentId); //then main is parent
    const id = parentId + parent.children.length + "ButtonBox";
    addEl(parentId, "div", id, ["center"]);
    for (let index = 0; index < buttonsList.length; index++) {
        const button = buttonsList[index];
        addEl(id, "button", "button" + index, [], button.onclick, [button.name]);
    }
}
function addScale(id, parentId) {
    parentId = parentId || "main";
    const boxId = id + "Box"
    addEl(parentId, "div", boxId);
    addEl(boxId, "div", id + "Line", ["line"]);
    addEl(boxId, "div", id, ["circle", "absolute"], (mouse) => moveScale(id, mouse));
}
function moveScale(id, mouse) {
    let element = el(id);
    if (!element) return;
    console.log(mouse); //here in progress
}
function addTaskList(tasks) {
    const parentId = "tasks";
    addEl("main", "div", parentId);
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        let taskType = isEvent(task) ? "event" : "task";
        addEl(parentId, "div", "task_" + task.id, [taskType]);
        addEl("task_" + task.id, "div", "taskText_" + task.id, [], () => {
            chooseTask(task.id);
        }, [task.text]);
    }
}
function taskTimeLine(task) {
    const date = getDate();
    let string = "";
    let startDate = task.startDate || task.date;
    let startTime = task.startTime || task.time;
    string = dateToString(startDate) + ", " + timeToValue(startTime);
    if (timeDif(startDate, startTime, task.date, task.time) != 0) {
        string += " bis ";
        if (!equalDate(startDate, task.date))
            string += dateToString(task.date) + ", ";
        string += timeToValue(task.time);
    }
    if (task.duration) string += " (" + Math.ceil(task.duration / 60) + "min)";
    if (task.repeat) string += " (Wdh)";
    return string;
}
function addSubTasks(id) {
    const tasks = sortTasksByEnd(findLinkedTasks(id, true));
    addEditTasks(tasks, false, id);
}
function addEditTasks(tasks, isAcitveEvent, mainTask) {
    let parentId = "shinyTasks";
    if (el(parentId)) el(parentId).innerHTML = ``; //add list
    else addEl("main", "div", parentId);
    for (let index = 0; index < tasks.length; index++) { //add elements
        if (index == 6) { //add further to 
            addShowFurther(() => furtherEditTasks(5), "furtherTasks", "shinyTasks", 90);
        }
        const task = tasks[index];
        const taskId = "task_" + task.id;
        let taskType = isEvent(task) ? "event" : "shinyTask";
        addEl(parentId, "div", taskId, [taskType], null, [["hidden", index >= 6]]);
        const upperPartId = "upperTask" + task.id; //add lower when choosing
        addEl(taskId, "div", upperPartId, ["ordered"]); //for content
        const taskContentId = "taskContent_" + task.id;
        const taskOptionsId = "taskOptions" + task.id;
        addEl(upperPartId, "div", taskContentId); //infos about task
        addEl(upperPartId, "div", taskOptionsId); //button for choose
        addEl(taskContentId, "div", "textLine_" + task.id, ["left"], () => pageViewTask(task.id), [task.text]);
        addEl(taskContentId, "div", "timeLine_" + task.id, ["left"], () => pageEditTask(task.id), [taskTimeLine(task)]);
        addEl(taskOptionsId, "div", "optionButton_" + task.id, ["circle"], () => {
            chooseSubTask(task.id, isAcitveEvent, mainTask);
        });
    }
}
function furtherEditTasks(curIndex) {
    const tasks = (el("shinyTasks") || {}).children || [];
    for (let index = 0; index < tasks.length; index++) {
        const task = tasks[index];
        task.hidden = index > curIndex;
    }
    removeEl("furtherTasks");
    if (curIndex < tasks.length)
        addShowFurther(() => furtherEditTasks(curIndex + 6), "furtherTasks", "shinyTasks", 90);
    else addShowFurther(() => furtherEditTasks(5), "furtherTasks", "shinyTasks", 270);
}
function addShowFurther(onclick, id, parentId, rotateAngle) {
    parentId = parentId || "main";
    let parent = el(parentId);
    if (!id) id = parent.id + "ShowButton" + parent.children.length;
    let rotate = "rotate(" + (rotateAngle || 0) + "deg)";
    addEl(parentId, "div", id, ["center"]);
    addEl(id, "div", id + "Circ", ["circle", "center", "middle"], onclick, [">"], [["transform", rotate]]);
}
function addLinks(linkSites, id) {
    linkSites = Object.entries(cl(linkSites)); //as array
    if (!linkSites.length) return; //add no links
    linkSites = sortInSites(linkSites); //array of arrays (sites)
    let linkIndex = Math.floor(linkSites.length / 2);
    switchLinkSite(linkIndex, linkSites, id);
}
function switchLinkSite(newIndex, sites, id) {
    let choosedSite = sites[newIndex];
    if (!choosedSite) return alertInfo("Seite existiert nicht");
    if (!el("linkTypes")) addEl("main", "div", "linkTypes"); //ensure main box
    else el("linkTypes").innerHTML = '';
    addEl("linkTypes", "div", "arrows", ["ordered"]);
    if (newIndex - 1 >= 0) //navigate back or towards
        addShowFurther(() => switchLinkSite(newIndex - 1, sites, id),
            "leftSide", "arrows", 180); //left side
    else addEl("arrows", "div", "noLeftArrow"); //to get ordered place
    if (newIndex + 1 < sites.length)
        addShowFurther(() => switchLinkSite(newIndex + 1, sites, id),
            "rightSide", "arrows", 0); //right side
    else addEl("arrows", "div", "noRightArrow");
    addLinkTypes(choosedSite, id);
}
function addLinkTypes(linkTypes, id) {
    for (let index = 0; index < linkTypes.length; index++) {
        const linkType = linkTypes[index][0];
        const links = linkTypes[index][1];
        const boxId = linkType + "Box";
        addEl("linkTypes", "div", boxId, ["object", "ordered"]);
        const linkTypeId = linkType + "LinkBox";
        addEl(boxId, "div", linkTypeId, ["left", "vert"]);
        addEl(linkTypeId, "div", linkType + "Text", [], () => pageRenameLinkType(linkType, id), [linkType]);
        const linksId = linkType + "Links";
        addEl(boxId, "div", linksId, ["right"]);
        addObjects(links, linksId);
    }
}
function addObjects(idList, parentId) {
    const objects = getObjects();
    for (let index = 0; index < idList.length; index++) {
        const id = idList[index];
        const object = indexById(id, objects, true);
        let text = objectValueToText(object);
        addEl(parentId, "div", "object" + id, ["object"],
            () => pageViewObject(id), [text]);
    }
}
function sortInSites(array) {
    if (!array) return [];
    array = cl(array); //no change on recent array
    let elGroups = [];
    for (let index = 0; index < array.length; index++) {
        const element = array[index];
        if (index % 6 == 0) elGroups.push([element]); //new group each 6 obj
        else { //add further object
            let lastGroup = lastEl(elGroups);
            lastGroup.push(element);
        }
    }
    let noEvenEls = [];
    let evenEls = [];
    for (let index = 0; index < elGroups.length; index++) {
        const objectGroup = elGroups[index];
        if (index % 2 == 1) evenEls.push(objectGroup);
        else noEvenEls.push(objectGroup); //index is "0" -> first -> not even
    }
    return evenEls.reverse().concat(noEvenEls); //to get 4 2 1 3 5 pattern
}
function alertInfo(text) {
    closeMainInfo(); //close recent
    const boxId = "mainInfoBox";
    addEl("mainInfoPlace", "div", boxId, ["task"]);
    addEl(boxId, "p", "mainInfoText", [], null, [text]);
    addButtons([{ name: "Ok", onclick: closeMainInfo }], boxId);
    let box = el(boxId);
    box.style.height = "0px";
    let height = (getInnerHeight(boxId) + 20);
    box.style.height = height + "px";
    setTimeout(closeMainInfo, 5000);
}
function closeMainInfo() {
    let box = el("mainInfoBox");
    if (!box) return;
    box.style.height = "0px";
    box.innerHTML = ``;
    setTimeout(() => removeEl("mainInfoBox"), 300);
}
function cl(value) { //structured clone
    return structuredClone(value);
}
function lastEl(array) {
    return array[array.length - 1];
}
function randEl(array) {
    return array[randIndex(array)];
}
function randIndex(array) {
    return rand(array.length - 1);
}
function mixArray(array) {
    let newArray = [];
    if (typeof array != "object") return [];
    while (array.length) { //move any el of old to new
        newArray.push(array.splice(rand(array.length - 1), 1)[0]);
    }
    array = newArray; //change array
    return array;
}
function exchangeElInArray(array, index1, index2) {
    array = array || [];
    index1 = index1 || 0;
    index2 = index2 || 0;
    if (array.length <= Math.max(index1, index2)) return array; //not valid
    const element1 = array[index1];
    const element2 = array[index2];
    array[index1] = element2; //exchange
    array[index2] = element1;
    return array;
}
function moveElInArray(array, indexFrom, indexTo) {
    array = array || [];
    indexFrom = indexFrom || 0;
    indexTo = indexTo || 0;
    if (array.length <= Math.max(indexFrom, indexTo)) return array; //not valid
    const element = array.splice(indexFrom, 1)[0];
    array.splice(indexTo, 0, element);
    return array;
}
function rand(from, to) {
    if (isNaN(from)) return rand(0, 1);
    else if (isNaN(to)) return rand(0, from);
    else {
        let number = Math.random() * (to - from + 1);
        number = Math.floor(number);
        return number + from;
    }
}
function findExtremeValues(numbers) {
    const sorted = sortNumbers(numbers); //sorted numbers
    const halfIndex = sorted.length / 2;
    const highNumbers = sorted.slice(0, Math.ceil(halfIndex));
    const lowNumbers = sorted.slice(Math.floor(halfIndex), sorted.length);
    const highNumber = average(highNumbers);
    const lowNumber = average(lowNumbers);
    return {
        high: highNumber,
        low: lowNumber
    }
}
function average(numbers) {
    let sumNumber = 0;
    for (let index = 0; index < numbers.length; index++) {
        const number = numbers[index];
        sumNumber += number;
    }
    return sumNumber / numbers.length;
}
function sortNumbers(numbers) {
    let amount = 100000;
    while (amount > 0) { //finish when break
        amount--;
        let change;
        for (let index = 0; index < numbers.length - 1; index++) {
            const highNumber = numbers[index];
            const lowNumber = numbers[index + 1];
            if (highNumber < lowNumber) { //wrong order
                numbers[index] = lowNumber;
                numbers[index + 1] = highNumber;
                change = true;
            }
        }
        if (!change) break;
    }
    return numbers;
}
function getDate() {
    let date = new Date();
    return {
        date: date.getDate(),
        weekday: date.getDay() == 0 ? 7 : date.getDay(), //monday is 1, sunday is 7
        month: date.getMonth() + 1, //not index of month
        year: date.getFullYear()
    }
}
function stringToDate(string) {
    string = string.split(".");
    for (let dateLevel = 0; dateLevel < 3; dateLevel++) {
        const currentValue = dateLevel == 0 ? getDate().date :
            dateLevel == 1 ? getDate().month : getDate().year; //current value od date
        string[dateLevel] = string[dateLevel] || currentValue;
    }
    if (string[2] < 2000) string[2] += 2000; //year 25 to 2025
    return {
        date: string[0],
        month: string[1],
        year: string[2]
    }
}
function dateToString(date, simpleFormat) {
    const calcDate = cl(date);
    const curDate = getDate();
    let string = calcDate.date + ".";
    if (calcDate.month != curDate.month) string += calcDate.month + ".";
    if (!calcDate.year) {
        calcDate.year = getDate().year;
        if (isPastDate(calcDate, curDate)) calcDate.year++;
    }
    if (calcDate.year != curDate.year) string += calcDate.year;
    if (!simpleFormat) { //year def and is larger format
        const dayDif = dateDif(curDate, calcDate);
        const weekDays = weekdays();
        let weekday = curDate.weekday + dayDif;
        if (weekday <= 0) //move weekdays without change
            weekday += 7 * (Math.ceil(Math.abs(weekday) / 7) + 1);
        weekday = (weekday - 1) % 7; //turn to index
        weekday = weekDays[weekday];
        string = weekday + ", " + string;
        if (dayDif == 0) string = "Heute (" + string + ")";
        else if (dayDif == 1) string = "Morgen (" + string + ")";
        else if (dayDif == -1) string = "Gestern (" + string + ")";
        else if (dayDif == 2) string = "Übermorgen (" + string + ")";
        else if (dayDif == -2) string = "Vorgestern (" + string + ")";
    }
    return string;
}
function weekdays() {
    return ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
}
function dateToValue(date) {
    if (typeof date != "object") return undefined;
    let string = "";
    string += date.year + "-";
    string += date.month <= 9 ? "0" + date.month : date.month;
    string += "-";
    string += date.date <= 9 ? "0" + date.date : date.date;
    return string;
}
function valueToDate(value) {
    if (typeof value != "string") return undefined;
    value = value.split("-");
    if (value.length != 3) return null; //wrong format
    return {
        date: Number(value[2]),
        month: Number(value[1]),
        year: Number(value[0])
    }
}
function dateDif(pastDate, presDate) {
    if (typeof pastDate != "object") return;
    if (typeof presDate != "object") return;
    let newPastDate = { //set new dates to avoid changing
        date: Number(pastDate.date),
        month: Number(pastDate.month),
        year: Number(pastDate.year)
    }
    let newPresDate = {
        date: Number(presDate.date),
        month: Number(presDate.month),
        year: Number(presDate.year)
    }
    if (isPastDate(newPresDate, newPastDate)) //wrong order
        return -dateDif(newPresDate, newPastDate);
    let amount = 0;
    while (!equalDate(newPastDate, newPresDate) && amount < 36500) {
        amount++;
        newPastDate = nextDate(newPastDate);
    }
    return amount;
}
function isPastDate(pastDate, date) {
    if (pastDate.year < date.year) return true; //year
    if (pastDate.year > date.year) return false;
    if (pastDate.month < date.month) return true; //month
    if (pastDate.month > date.month) return false;
    if (pastDate.date < date.date) return true; //date
    if (pastDate.date > date.date) return false;
    return null; //same date
}
function nextDate(date) {
    let newDate = { //avoid changing
        date: date.date,
        month: date.month,
        year: date.year
    }
    let months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (newDate.year % 4 == 0) months[1] = 29; //leap year
    let monthLength = months[newDate.month - 1]; //index of month
    newDate.date = (newDate.date % monthLength) + 1;
    if (newDate.date == 1) { //new month
        newDate.month = (newDate.month % 12) + 1;
        if (newDate.month == 1) newDate.year++; //new year
    }
    return newDate;
}
function addDate(date, amount) {
    let newDate = {
        date: date.date,
        month: date.month,
        year: date.year
    }
    for (let number = amount; number > 0; number--) {
        newDate = nextDate(newDate);
    }
    return newDate;
}
function lastDate(date) {
    let newDate = { //avoid changing
        date: date.date,
        month: date.month,
        year: date.year
    }
    let months = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (newDate.year % 4 == 0) months[1] = 29; //leap year
    newDate.date--;
    if (newDate.date == 0) { //new month
        newDate.month--;
        if (newDate.month == 0) { //new year
            newDate.year--;
            newDate.month = 12;
        }
        newDate.date = months[newDate.month - 1];
    }
    return newDate;
}
function backDate(inputDate, amount) {
    let date = {
        date: inputDate.date,
        month: inputDate.month,
        year: inputDate.year
    }
    for (let back = amount; back > 0; back--) {
        date = lastDate(date);
    }
    return date;
}
function equalDate(date1, date2) {
    return (Number(date1.date) == Number(date2.date) &&
        Number(date1.month) == Number(date2.month) &&
        (Number(date1.year) || null) == (Number(date2.year) || null)
    );
}
function getTime() {
    let time = new Date();
    return time.getSeconds() + time.getMinutes() * 60 + time.getHours() * 60 * 60;
}
function timeToValue(time) {
    if (typeof time != "number") return undefined;
    time = (time) % (24 * 60 * 60); //at a day
    if (time < 0) time = 24 * 60 * 60 - time;
    let secs = time % 60;
    time -= secs;
    let mins = (time / 60) % 60;
    mins = mins <= 9 ? "0" + mins : mins;
    time -= mins * 60;
    let hours = time / 60 / 60;
    hours = hours <= 9 ? "0" + hours : hours;
    return hours + ":" + mins;
}
function valueToTime(value) {
    if (typeof value != "string") return undefined;
    value = value.replaceAll(".", ":");
    value = value.split(":");
    if (value.length == 1) value.push("00");
    return (Number(value[0]) * 60 * 60) + (Number(value[1]) * 60);
}
function addTime(date, time, addTime) {
    time += addTime; //sum time
    let days = Math.floor(time / 24 / 60 / 60);
    time -= days * 24 * 60 * 60; //remove whole days
    date = addDate(date, days); //add days to date
    return { date: date, time: time };
}
function getTasks() {
    const manager = get("manager") || {};
    return manager.tasks || [];
}
function saveTasks(tasks, changeAcc) {
    if (typeof tasks != "object") return;
    let manager = getManager();
    manager.tasks = tasks;
    saveManager(manager, changeAcc);
}
function getIntents() {
    let manager = getManager();
    return manager.intents || [];
}
function saveIntents(intents, changeAcc) {
    if (typeof intents != "object") return console.error("no data");
    let manager = getManager();
    manager.intents = intents;
    saveManager(manager, changeAcc);
}
function getObjects() {
    let manager = getManager();
    return manager.objects || [];
}
function saveObjects(objects, changeAcc) {
    if (!objects) console.error("no data");
    else {
        let manager = getManager();
        manager.objects = objects;
        saveManager(manager, changeAcc);
    }
}
function getManager() {
    return get("manager") || {};
}
function saveManager(manager, changeAcc = false) {
    if (typeof manager == "object") {
        save("manager", manager);
        if (manager.dataId && changeAcc)
            changeDBData(manager); //try to change
    } else console.error("no manager");
}
async function backendData(functionName = "getAccount", input) {
    const res = await fetch("/.netlify/functions/" + functionName, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const text = await res.text();
        console.error("Fehler von Function:", text);
        throw new Error(`Fetch failed: ${res.status}`);
    }
    const output = await res.json();
    try {
        return JSON.parse(output); //manager
    } catch {
        return output; //data id
    }
}
function getDBData(dataId, handler = () => { }) {
    backendData("getAccount", dataId)
        .then((manager) => {
            if (manager == "No Account") manager = null;
            handler(manager)
        });
}
function addDBData(manager, handler) {
    backendData("newAccount", manager)
        .then((newId) => handler(String(newId)));
}
function changeDBData(manager, handler = () => { }) {
    backendData("saveAccount", manager).then(handler);
}
function deleteDBData(dataId) {
    fetch(`https://api.airtable.com/v0/${baseId}/${tableName}/${dataId}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`
        }
    })
        .then(response => response.json())
        .catch(error => console.error('Fehler:', error));
}
function save(key, value) {
    value = JSON.stringify(value);
    localStorage.setItem(key, value);
}
function get(key) {
    let value = localStorage.getItem(key);
    return JSON.parse(value);
}
function note(key, value) {
    value = JSON.stringify(value);
    sessionStorage.setItem(key, value);
}
function read(key) {
    let value = sessionStorage.getItem(key);
    return JSON.parse(value);
}
function downloadManager() {
    const title = "Manager-" + getDate().month + "-" + getDate().date;
    downloadString(JSON.stringify(getManager()), title);
}
function downloadString(string, filename = "Text") {
    if (!string) return;
    const blob = new Blob([string], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
function setHeight() {
    let inputs = document.getElementsByTagName("textarea");
    for (let index = 0; index < inputs.length; index++) {
        const element = inputs[index];
        element.style.height = "auto";
        element.style.height = element.scrollHeight + "px";
    }
}
function setDate(id) {
    let element = el(id);
    if (element.type == "date") element.value = dateToValue(getDate());
}
function setTime(id) {
    let element = el(id);
    if (element.type == "time") element.value = timeToValue(getTime());
}
function setPosInt() {
    const inputs = document.getElementsByClassName("posInt");
    for (let index = 0; index < inputs.length; index++) {
        const element = inputs[index];
        element.value = Math.round(Math.abs(element.value));
    }
}
function addEl(parentId = "main", node, id, classes, onclick, properties, style) {
    let element = document.createElement(node);
    element.id = id;
    classes = classes || [];
    for (let index = 0; index < classes.length; index++) {
        const addClass = classes[index];
        element.classList.add(addClass);
    }
    style = style || [];
    for (let index = 0; index < style.length; index++) {
        const styleEl = style[index];
        element.style[styleEl[0]] = styleEl[1];
    }
    properties = properties || [];
    for (let index = 0; index < properties.length; index++) {
        const prop = properties[index];
        if (typeof prop == "object") element[prop[0]] = prop[1];
        else element.innerText = prop;
    }
    if (onclick) element.addEventListener("click", onclick);
    if (el(parentId)) el(parentId).appendChild(element);
    else el("main").appendChild(element);
}
function removeEl(id) {
    let element = el(id);
    if (element) {
        let parent = element.parentElement;
        parent.removeChild(element);
    }
}
function findEl(parentEl, id) { //find in parent
    if (!parentEl) return null;
    let children = parentEl.children;
    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        if (child.id == id) return child;
        const result = findEl(child, id);
        if (result) return result;
    }
    return null;
}
function getInnerHeight(id) {
    let element = el(id);
    if (!element) return 0;
    let height = 0;
    let children = element.children || [];
    for (let index = 0; index < children.length; index++) {
        const child = children[index];
        height += child.scrollHeight || 0;
    }
    return height;
}
function el(id) {
    return document.getElementById(id);
}
