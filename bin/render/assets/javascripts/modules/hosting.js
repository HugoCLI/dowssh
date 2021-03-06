console.log('modules/hosting.js loaded');


const elementConnections = doc.querySelector('.connections');
const elementRepositories = doc.querySelector('.connections .repositories');
const elementHome = doc.querySelector('.home');

let connections = {};
let first_host = true;
ipcRenderer.on('profiler-connect-status', async (event, data) => {
    if (!connections[data.conn_id]) connections[data.conn_id] = data;

    const uuid = connections[data.conn_id].uuid;
    if (data.status === 0) {
        const div_conn = doc.createElement('div');
        div_conn.setAttribute('id', 'conn-' + data.conn_id);
        div_conn.classList.add('conn-id');
        doc.querySelector('.connections').setAttribute('active', data.conn_id);
        const target = doc.createElement('div');
        target.classList.add('target_listening');
        target.setAttribute('id', 'log-' + data.conn_id);
        target.addEventListener('click', () => {
            notification.success("Chemin d'accès copié");
            navigator.clipboard.writeText(target.innerText);
        })
        div_conn.appendChild(target);

        const repositories = doc.createElement('div');
        repositories.classList.add('repositories');
        repositories.innerHTML = `<div class="loading"><div class="loader-animation"><span></span><span></span><span></span></div></div>`;
        div_conn.appendChild(repositories);
        elementConnections.appendChild(div_conn);
        let name = hosts[data.uuid].host;
        if (hosts[data.uuid].name) name = hosts[data.uuid].name;


        let count = 0;
        for (const [key, value] of Object.entries(connections))
            if (value.uuid === data.uuid) count += 1;
        count > 1 ? name += ` (${count})` : null;


        document.querySelector('#onglets').innerHTML += `<div id="tab-${data.conn_id}" uuid="${data.conn_id}" class="item"><div><h4>${name}</h4><p>${hosts[data.uuid].host}:${hosts[data.uuid].port}</p></div></div>`

        setTimeout(async () => doc.querySelector('#tab-'+data.conn_id).classList.add('active'),500)
        renewTabs();

    }
    if (data.status === 1) {
        if(first_host) {
            doc.querySelector('.conseil').classList.add('show');
            setTimeout(async() => doc.querySelector('.conseil').classList.remove('show'), 4000)
            first_host = false;
        }
        let repos = hosts[uuid].username !== "root" ? "/home/" + hosts[uuid].username : '/root';
        menu.displayConnection(data.conn_id);
        sendData('profiler-sftp-list', {conn_id: data.conn_id, path: repos});
        doc.querySelector('.loader').style.display = "none";
    }
    if (data.status === 3)
        closeOnglet(data.conn_id, null, hosts[uuid].host + " : " + data.error);

})
const closeOnglet = (uuid, success = null, error = null) => {
    const isActive = doc.querySelector('.connections').getAttribute('active') === uuid ? true : false;
    doc.querySelector('#tab-' + uuid).remove();
    doc.querySelector('#conn-' + uuid).remove();
    doc.querySelector('.loader').style.display = "none";
    if(success) notification.success(success);
    if(error) notification.error(error);
    delete connections[uuid];
    sendData('profiler-disconnect', uuid);
    if(isActive) menu.home();
}

const renewTabs = () => {
    doc.querySelectorAll('#onglets .item').forEach((e) => {
        const uuid = e.getAttribute('uuid');
        e.addEventListener('click', (e) => {
            menu.displayConnection(uuid);
        })


    });
}
const elementClickable = (conn_id) => {
    let repositories = doc.querySelector('.connections #conn-' + conn_id + " .repositories");
    const items = doc.querySelectorAll('.connections #conn-' + conn_id + ' .repositories .item');
    for (let i = 0; i < items.length; i++) {
        const element = items[i];
        element.addEventListener('dblclick', function (e) {
            if (element.getAttribute('type') === "folder")
                return sendData('profiler-sftp-list', {
                    conn_id: conn_id,
                    path: e.target.closest('.item').getAttribute('target')
                });
            downloadFile(conn_id);
        });
        element.addEventListener('click', (e) => selected(e, element, false))
        element.addEventListener('contextmenu', (e) => selected(e, element, true))
    }
    const selected = (e, element, clicked = false) => {
        items.forEach(item => item.classList.remove('selected'));
        element.classList.add('selected');
        if (clicked) displayAction(e, element.getAttribute('uuid'));
    }

}
doc.querySelector('.contains').addEventListener('click', (e) => {
    if (doc.querySelector('.rightclick').classList.contains('hide')) return;
    if (!e.target.closest('.rightclick')) doc.querySelector('.rightclick').classList.add('hide')
})

window.addEventListener('scroll', (event) => {
    if (doc.querySelector('.rightclick').classList.contains('hide')) return;
    doc.querySelector('.rightclick').classList.add('hide')
});
const displayAction = (e, uuid) => {
    if (doc.querySelector(`.item[uuid="${uuid}"]`).hasAttribute('not-folder')) return;
    doc.querySelector('.rightclick').style.left = (e.pageX - 50) + "px";
    doc.querySelector('.rightclick').classList.remove('hide');
    doc.querySelector('.rightclick').style.top = (e.pageY + 10) + "px";
}

const downloadFile = (conn_id) => {
    doc.querySelector('.connections #conn-' + conn_id + " .repositories").innerHTML = `<div class="loading"><div class="loader-animation"><span></span><span></span><span></span></div></div>`;
}
const extRegex = /(?:\.([^.]+))?$/;
ipcRenderer.on('profiler-sftp-list', async (event, data) => {

    let repositories = doc.querySelector('.connections #conn-' + data.conn_id + " .repositories");
    repositories.innerHTML = "";
    let repos = [];
    let files = [];
    doc.querySelector('#log-' + data.conn_id).innerText = data.path;
    repositories.innerHTML += `<div class="head"><div></div><div>Name</div><div>Date Modified</div><div>Size</div><div>Permissions</div></div>`;
    if (data.path !== "/") {
        const uuid = genUuid();
        let path_split = data.path.split('/');
        let new_path = "/";

        if (path_split.length > 0) {
            path_split.pop();
            new_path = path_split.join('/');
            if (new_path === "") new_path = "/";
        }


        let item = doc.createElement('div');
        item.classList.add('item');
        item.setAttribute('type', 'folder');
        item.setAttribute('target', new_path)
        item.setAttribute('not-folder', true)
        item.setAttribute('uuid', uuid)


        item.innerHTML = `<div></div><div>..</div><div></div>`;
        item.classList.add('gray');
        repositories.appendChild(item);
    }

    let path = data.path;
    if (data.path === "/") path = "";
    for (const [key, value] of Object.entries(data.result)) {
        const uuid = genUuid();
        const ext = extRegex.exec(value.name)[1]; // Maybe null
        if (value.type === "d")
            repositories.innerHTML += `<div type="folder" class="item" target="${path}/${value.name}" uuid="${uuid}"><div><i class='bx bx-folder'></i></div><div>${value.name}</div><div>${new Date(value.modifyTime).toLocaleString()}</div><div></div><div>${value.longname.split(' ')[0]}</div></div>`;
        else
            repositories.innerHTML += `<div type="file" class="item" uuid="${uuid}" name="${value.name}"><div><i class='bx ${icones[ext] ? icones[ext] : 'bx-file-blank'}'></i> </div><div>${value.name}</div><div>${new Date(value.modifyTime).toLocaleString()}</div><div>${formatBytes(value.size)}</div><div>${value.longname.split(' ')[0]}</div></div>`;

    }
    if (Object.entries(data.result).length === 0)
        repositories.innerHTML += "<error>Ce dossier est vide</error>";

    elementClickable(data.conn_id);

});
doc.querySelector('.hosts').addEventListener("click", event => {
    if (!event.target.closest('.icon')) return;
});

doc.querySelector('[action="onglet-disconnect"]').addEventListener("click", event => {
    let uuid = doc.querySelector('.connections').getAttribute('active');
    if(uuid === "default") return;
    closeOnglet(uuid, "Déconnecté avec succès");
});


doc.querySelector('.hosts').addEventListener("dblclick", event => {
    const element = event.target.closest('.item');
    if (event.target.closest('.icon')) return;
    if (!element) return;
    const uuid = element.getAttribute('host');
    doc.querySelector('.loader').style.display = "flex";
    menu.close();
    sendData('profiler-connect', uuid);
})

