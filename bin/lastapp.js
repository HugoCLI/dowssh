const start = async () => {

    // session.config.host = prompt('Remote address > ');
    // if(!session.config.host) return process.exit(-1);
    // session.config.port = prompt('SFTP access port (22 by default) > ');
    // if(!session.config.port) session.config.port = 22;
    // session.config.username = prompt('Username > ');
    // if(!session.config.username) return process.exit(-1);
    // session.config.password = prompt('Password > ');

    console.log(chalk.yellow('Try to connecting...'));
    try {
        await sftp.connect(session.config);
        console.log(`${session.config.host} \t${chalk.green('Connected')}`);
        session.path_local = `profile/downloads/${session.config.host}`;
        await create.folder(session.path_local)
        session.path_local += "/";
        // requestGet();
    } catch (e) {
        console.log(chalk.red('ERROR') + " Unable to connect to remote server")
        process.exit(-1)
    }

}

// const requestGet = async () => {
//     let ac = prompt('Directory to download > ');
//     if (ac[ac.length - 1] === "/") ac = ac.substring(0, ac.length - 1);
//     session.path_remote = ac;
//     session.repositories = [];
//     session.size = {total: 0, downloaded: 0, speed: 0}
//     session.statistics = {d: 0, f: 0}
//     session.instance = 0;
//     session.cache = {seek: 0, receiveSize: 0};
//     for (let i = 0; i < 3; i++) console.log("")
//     getSFTP(ac);
//     liveDisplay();
//
// }

function formatBytes(a, b = 2, k = 1024) {
    with (Math) {
        let d = floor(log(a) / log(k));
        return 0 == a ? "0 B" : parseFloat((a / pow(k, d)).toFixed(2)) + " " + ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"][d]
    }
}


const liveSpeed = async () => {
    if (session.instance === 0) return;
    session.size.speed = session.cache.receiveSize * 4;
    session.size.downloaded += session.cache.receiveSize;
    session.cache.receiveSize = 0;
    setTimeout(async () => liveSpeed(), 250)
}
const liveDisplay = async () => {
    if (session.instance === 0) return confirmDownload();
    for (let i = 0; i < 3; i++) clearLastLine();
    console.log("\nCalculating...\tSize: " + chalk.yellow(formatBytes(session.size.total)) + "\tFiles: " + chalk.yellow(session.statistics.f) + "\tDirectory: " + chalk.yellow(session.statistics.d) + "\tConnexion: " + chalk.yellow(session.instance) + "\n");
    setTimeout(async () => liveDisplay(), 250)
}

const confirmDownload = () => {
    const rep = prompt('Voulez-vous télécharger ' + formatBytes(session.size.total) + " ? [(Y)es / (N)o] > ");
    if (rep[0].toLocaleUpperCase() !== "Y") return process.exit(-1);
    download();
    liveSpeed();
}

const download = async () => {
    if (session.repositories.length > 0) {
        if (session.instance < 30) {
            downloadFile(session.repositories[0])
            session.repositories.shift();
            if (session.instance < 30) download();
        }
        return;
    }
    for (let i = 0; i < 3; i++) clearLastLine();
    console.log("\n" + chalk.yellow("100.00% ") + 'Finish \t ' + formatBytes(session.size.downloaded) + "\t" + process.cwd() + "/" + session.path_local + "\n");
    process.exit(-1)
}

const downloadFile = async (data) => {
    const e = data.split('::');
    session.instance += 1;
    session.cache.receiveSize += parseInt(e[1]);


    const target = process.cwd() +"/"+ session.path_local+ e[2].substring(session.path_remote.length+1, e[2].length).replaceAll('/', "/");
    const target_folder = target.split("/").slice(0, -1).join("/");

    if (e[0] === "d") {
        await create.folder(target, true)
    } else {
        await create.folder(target_folder);
        await sftp.get(e[2], await create.stream(target));
    }
    nextFile(target);
}

const nextFile = (target) => {
    for (let i = 0; i < 3; i++) clearLastLine();
    console.log(chalk.gray(target))
    console.log("\n" + chalk.yellow((100 / session.size.total * session.size.downloaded).toFixed(2) + "% ") + 'Downloading ... \t ' + chalk.cyan(formatBytes(session.size.speed) + "/s") + " \t" + formatBytes(session.size.downloaded) + " sur " + formatBytes(session.size.total) + "\n");
    session.instance -= 1;
    download();
}

const clearLastLine = () => {
    process.stdout.moveCursor(0, -1) // up one line
    process.stdout.clearLine(1) // from cursor to end
}

const getSFTP = async (path) => {
    if (session.instance < 50) {
        session.instance += 1;
        let ac = path;
        if (ac[ac.length - 1] === "/") ac = ac.substring(0, ac.length - 1);

        const result = await sftp.list(`${path}`);
        session.instance -= 1;
        traiteSFTP(ac, result)
    } else {
        setTimeout(async () => getSFTP(path), 1);
    }
}

const traiteSFTP = async (path, object) => {
    for (const [key, value] of Object.entries(object)) {
        session.size.total += parseInt(value.size);
        let type = "d";
        if (value.type !== "d") type = "f";
        session.statistics[type] += 1;

        session.repositories.push(type + "::" + value.size + "::" + path + "/" + value.name)
        if (type === "d") getSFTP(`${path}/${value.name}/`);
    }

}