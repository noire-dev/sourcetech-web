
const MATCH_ADDRESS = /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\:[0-9]+/gi
const MODNAME = 'milab';


function getQueryCommands() {
	// Wow, look at all the unfuckery I don't have to do with startup options because
	//   I'm not using emscripten anymore.
	let startup = [
		'quake3e_web',
		'+set', 'fs_basepath', '/base',
		'+set', 'fs_homepath', '/home',
		'+set', 'sv_pure', '0', // require for now, TODO: server side zips
		'+set', 'r_mode', '-2',
		'+set', 'net_socksServer', window.location.hostname || '',
		'+set', 'net_socksPort', window.location.port 
			|| (window.location.protocol == 'https:' ? '443' : '80'),
		'+set', 'sv_fps', '60',
		'+set', 'com_hunkMegs', '256',
		'+set', 'snaps', '60',
		// ISN'T HELPING STUPID NETWORK CRASH BUG
		//'+set', 'cl_nodelta', '1',
		'+set', 'r_fastsky', '0',
		// use high pic mip because images are displayed at the initial quality
		//   they are loaded by the browser, so even the highest picmip (worst quality)
		//   will have the same image but backend won't spend so much time on it.
		'+set', 'r_picmip', '16',
		//'+set', 's_initsound', '0',
		// it doesn't make sense to display a CD key in this client because it doesn't
		//   come with any game content
		'+set', 'ui_cdkeychecked', '1',
		// TURN OFF UDP DOWNLOADS, TURN ON REDIRECT
		'+set', 'cl_allowDownload', '5',
		// each one of the following has a special meaning
		//'+set', 'r_ext_multitexture', '0',
		// not implemented in javascript?
		'+set', 'r_ignorehwgamma', '1',
		// FBO shows up all black and textures don't bind, 
		//   but this should work in theory with WebGL
		'+set', 'r_ext_framebuffer_object', '0',
		'+set', 'r_ext_direct_state_access', '0',
		// Cause of FBO bug above?
		'+set', 'r_overBrightBits', '0',
		// this was replaced in QuakeJS, instead of replacing, just change cvar
		'+set', 'r_drawBuffer', 'GL_NONE',
		'+set', 'r_ext_texture_filter_anisotropic', '1',
		//'+set', 'r_finish', '1',
		// save time loading???
		'+set', 'r_vertexLight', '0',
		'+set', 'r_dynamiclight', '1',
		
		//'+set', 'r_ext_framebuffer_multisample', '0',
		// this prevents lightmap from being wrong when switching maps
		//   renderer doesn't restart between maps, but BSP loading updates
		//   textures with lightmap by default, so this keeps them separate
		'+set', 'r_mergeLightmaps', '0',
		//'+set', 'r_deluxeMapping', '0',
		//'+set', 'r_normalMapping', '0',
		//'+set', 'r_specularMapping', '0',
	]
	startup.push.apply(startup, window.preStart)
	// TODO: full screen by default? I suppose someone might 
	//   want to embed in the center of a page, edit CSS instead of JS?
	startup.push.apply(startup, [
		'+set', 'r_fullscreen', window.fullscreen ? '1' : '0',
		'+set', 'r_customHeight', '' + GL.canvas.clientHeight || 0,
		'+set', 'r_customWidth', '' + GL.canvas.clientWidth || 0,
		'+set', 'r_customAspect', '' + (GL.canvas.clientWidth / GL.canvas.clientHeight) || 0,
	])
	// meant to do this a lot sooner, with a download, we can just package
	//   whatever pk3/autoexec we want with the game.
	// but with web, we might be serving multiple sources, file:///index.html
	//   http://localhost/ and public quake.games/lvlworld. so i don't have
	//   to repackage for every source, check the domain we're on.
	let hostname = (/^(.*?)\./i).exec(window.location.hostname)
	let gamename = false
	if(hostname) {
		gamename = hostname[1]
	} else
	if(window.location.protocol == 'file:') {
		gamename = 'localhost'
	}

	if(gamename) {
		//startup.push.apply(startup, [
		//	'+set', 'fs_game', gamename,
		//])
		if(typeof FS.virtual[gamename] == 'undefined') {
			FS.virtual[gamename] = {
				timestamp: new Date(),
				mode: FS_DIR,
			}
		}
	}

	let search = /([^&=]+)/g
	let query  = window.location.search.substring(1)
	let match
	while (match = search.exec(query)) {
		let val = decodeURIComponent(match[1])
		val = val.split(' ')
		val[0] = (val[0][0] != '+' ? '+' : '') + val[0]
		startup.push.apply(startup, val)
	}


	// TODO: from URL or default.cfg?
	if(!startup.includes('fs_game')) {
		startup.push.apply(startup, [
			'+set', 'fs_basegame', MODNAME,
			'+set', 'fs_game', MODNAME,
		])
		if(typeof FS.virtual[MODNAME] == 'undefined') {
			FS.virtual[MODNAME] = {
				timestamp: new Date(),
				mode: FS_DIR,
			}
		}
	}

	// try to get connect address out of window
	let connectAddr = MATCH_ADDRESS.exec(window.location.pathname)
	if(connectAddr && !startup.includes('map')
		&& !startup.includes('spmap') && !startup.includes('devmap')
		&& !startup.includes('spdevmap')) {
		startup.push.apply(startup, [
			'+connect', connectAddr[0],
		])
	}

	return startup
}


function Sys_UnloadLibrary() {

}

function Sys_LoadLibrary() {
	
}

function Sys_LoadFunction() {
	
}


let messageTime = Date.now()
function Sys_Print(message) {
	let messageStr = addressToString(message)
	if(messageStr.includes('Client Information')) {
		messageTime = Date.now()
	}
	let stateMatch
	if(Date.now() - messageTime < 100 && (stateMatch = (/state:\s*([0-9]+)/g).exec(messageStr))) {
		SYS.state = parseInt(stateMatch[1])
	}
	if(messageStr.includes('error')
		|| messageStr.includes('RE_Shutdown')
		|| messageStr.includes('Hunk_Clear')
		|| messageStr.includes('ERROR:')) {
		console.error(messageStr)
	} else {
		console.log(messageStr)
	}
}

function Sys_Edit() {
	if(typeof window.ace == 'undefined') {
		return
	}

	if(Cmd_Argc() < 2) {
		Com_Printf(stringToAddress('Usage: edit [filename]\n'))
		return
	}

	let basegamedir = addressToString(FS_GetBaseGameDir())
	let gamedir = addressToString(FS_GetCurrentGameDir())
	let filename = Cmd_Argv(1)
	let filenameStr = addressToString(filename)
	if(filenameStr.startsWith('/')) {
		filenameStr = filenameStr.substr(1)
	}
	if(filenameStr.startsWith(gamedir)) {
		filenameStr = filenameStr.substr(gamedir.length)
	}
	if(filenameStr.startsWith(basegamedir)) {
		filenameStr = filenameStr.substr(basegamedir.length)
	}
	if(filenameStr.startsWith('/')) {
		filenameStr = filenameStr.substr(1)
	}
	if(!filenameStr || !filenameStr.length) {
		Com_Printf(stringToAddress('Usage: edit [filename]\n'))
		return
	}
	let openFilename = stringToAddress(filenameStr)

	let buf = stringToAddress('DEADBEEF') // pointer to pointer
	let length
	if ((length = FS_ReadFile(openFilename, buf)) > 0 && HEAPU32[buf >> 2] > 0) {
		let imageView = Array.from(HEAPU8.slice(HEAPU32[buf >> 2], HEAPU32[buf >> 2] + length))
		let utfEncoded = imageView.map(function (c) { return String.fromCharCode(c) }).join('')
		FS_FreeFile(HEAPU32[buf >> 2])
		ace.setValue(utfEncoded)
		// TODO: show relationships in Jarvis, 
		//   one module refers to another module
		//   these are the leaves of change that worry code reviewers
		ACE.filename = filenameStr
	} else {
		let vargs = stringToAddress('DEADBEEF') // pointer to pointer
		HEAPU32[vargs >> 2] = openFilename
		HEAPU32[(vargs >> 2) + 1] = 0
		Com_Printf(stringToAddress('File not found \'%s\'.\nUsage: edit [filename]\n'), vargs)
	}
}


function Sys_Return() {
	let returnUrl = addressToString(Cvar_VariableString(stringToAddress('cl_returnURL')))
	if(returnUrl) {
		window.location = returnUrl
	}
	// brian cullinan added this feature for Tig
	// client mode
	//let reconnect = addressToString(Cvar_VariableString(stringToAddress('cl_reconnectArgs')))
	//if(reconnect) {
	//	window.location = '/games/' + reconnect
	//}
	// single player mode
	//let mapname = addressToString(Cvar_VariableString(stringToAddress('mapname')))
	//if(mapname && mapname != 'nomap') {
	//	window.location = '/maps/' + mapname
	//}
}



function Sys_Exit(code) {
	SYS.exited = true
	GLimp_Shutdown(true)
	NET_Shutdown()
	if(SYS.frameInterval) {
		clearInterval(SYS.frameInterval)
		SYS.frameInterval = null
	}
	if(code == 0) {
		Sys_Return()
	}
	if(	GL.canvas ) {
		GL.canvas.remove()
	}
}

function Sys_Error(fmt, args) {
	let len = sprintf(STD.sharedMemory + STD.sharedCounter, fmt, args)
	if(len > 0)
		console.error('Sys_Error: ', addressToString(STD.sharedMemory + STD.sharedCounter))
	Sys_Exit( 1 )
	throw new Error(addressToString(fmt))
}

function Sys_SetStatus(status, replacementStr) {
	// TODO: something like  window.title = , then setTimeout( window.title = 'Quake3e' again)
	console.log(addressToString(status), replacementStr)
	
}

function CL_MenuModified(oldValue, newValue, cvar) {
	if(INPUT.modifyingCrumb) {
		return // called from ourselves below from a user action
	}
	if(window.location.orgin == null) {
		return
	}
	let newValueStr = addressToString(newValue)
	let newLocation = newValueStr.replace(/[^a-z0-9]/gi, '')
	if(!SYS.menuInited) { // keep track of first time the ui.qvm appears
		SYS.menuInited = true
		document.body.className += ' done-loading '
	}
	if(window.location.pathname.toString().includes(newLocation)) {
		// don't add to stack because it creates a lot of annoying back pushes
		return
	}
	history.pushState(
		{location: window.location.pathname}, 
		'Quake III Arena: ' + newValueStr, 
		newLocation)
}

function CL_ModifyMenu(event) {
	let oldLocation = window.location.pathname.toString().substring(1) || 'MAIN MENU'
	Cbuf_AddText( stringToAddress(`set ui_breadCrumb "${oldLocation}"\n`) );
	return true
}

function Sys_Frame() {
	if(SYS.inFrame) {
		return
	}
	if(INPUT.fpsModified != HEAPU32[(INPUT.fps >> 2) + 6]
		|| INPUT.fpsUnfocusedModified != HEAPU32[(INPUT.fpsUnfocused >> 2) + 6]) {
		Com_MaxFPSChanged()
	}
	function doFrame() {
		SYS.inFrame = true
		SYS.running = !SYS.running
		SYS.milliseconds = Date.now()
		try {
			if(typeof ACE != 'undefined') {
				renderFilelist()
			}
			Com_Frame(0 /* SYS.running */)
		} catch (e) {
			if(!SYS.exited && e.message == 'longjmp') {
				// let game Com_Frame handle it, it will restart UIVM
				console.error(e)
				stackRestore(STD.longjumps[e.stackPointer])
				Cbuf_AddText(stringToAddress('vid_restart\n'));
			} else
			if(!SYS.exited || e.message != 'unreachable') {
				Sys_Exit(1)
				throw e
			}
		}
		SYS.inFrame = false
	}
	if(HEAP32[gw_active >> 2]) {
		requestAnimationFrame(doFrame)
	} else {
		doFrame()
	}
}

function Sys_notify(ifile, path, fp) {
	openDatabase().then(function (db) {
		writeStore(ifile, path)
	})
	// TODO: ADD FILESYSTEM WATCHERS API INOTIFY 
	//   THAT READS A LIST GENERATED HERE
	if(typeof window.updateFilelist != 'undefined'
		&& !ACE.filestimer) {
		ACE.filestimer = setTimeout(updateFilelist, 100)
	}
}


function dynCall(ret, func, args) {
	return Module.table.get(func).apply(null, args)
}

function CreateAndCall(code, params, vargs) {
	let func
	if(typeof SYS.evaledFuncs[code] != 'undefined') {
		func = SYS.evaledFuncs[code]
	} else {
		let paramStr = addressToString(params)
		func = SYS.evaledFuncs[code] = eval('(function func'
			+ ++SYS.evaledCount + '($0, $1, $2, $3)'
			+ addressToString(code, 4096) + ')')
		func.paramCount = paramStr.split(',').filter(function (name) {
			return name.length > 0
		}).length
	}
	let args = HEAPU32.slice(vargs >> 2, (vargs >> 2) + func.paramCount)
	return func.apply(func, args)
}

function Sys_RandomBytes (string, len) {
	if(typeof crypto != 'undefined') {
		crypto.getRandomValues((new Int8Array(ENV.memory.buffer)).slice(string, string+(len / 4)))
	} else {
		for(let i = 0; i < (len / 4); i++) {
			ENV.memory.buffer[string] = Math.random() * 255
		}
	}
	return true;
}

function CL_Try_Fail_LoadJPG(fbuffer, filename, pic, width, height, cinfo) {
	try {
		CL_Try_LoadJPG(filename, cinfo, fbuffer, pic, width, height)
	} catch (e) {
		if(e.message == 'unreachable') {
			try {
				CL_Fail_LoadJPG(filename, fbuffer, cinfo)
			} catch (e) {}
		}
	}
}

let SYS = window.SYS = {
	evaledFuncs: {},
	evaledCount: 0,
	DebugBreak: function () { debugger },
	DebugTrace: function () { console.log(new Error()) },
	Sys_RandomBytes: Sys_RandomBytes,
	Sys_Exit: Sys_Exit,
	Sys_Edit: Sys_Edit,
	Sys_Return: Sys_Return,
	exit: Sys_Exit,
	Sys_Frame: Sys_Frame,
	Sys_Error: Sys_Error,
	Sys_UnloadLibrary: Sys_UnloadLibrary,
	Sys_LoadLibrary: Sys_LoadLibrary,
	Sys_LoadFunction: Sys_LoadFunction,
	popen: function popen() {},
	Sys_Print: Sys_Print,
	Sys_SetStatus: Sys_SetStatus,
	CL_MenuModified: CL_MenuModified,
	CreateAndCall: CreateAndCall,
	CL_Try_Fail_LoadJPG: CL_Try_Fail_LoadJPG,
}
