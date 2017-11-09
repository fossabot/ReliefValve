const path = require('path');
const os = require('os');
const nfs = require('fs');
const remote = require('electron').remote;
const dialog = remote.require('electron').dialog;
const app = remote.require('electron').app;
const shell = remote.require('electron').shell;
const appwin = remote.getCurrentWindow();
const Config = require('electron-config');
const config = new Config();
const SteamConfig = require('./index.js');
const Measure = require('./measure.js');
const logger = remote.require('electron-log');

var logPath = path.join( app.getPath( "userData" ), "log.txt" );

logger.transports.file.level = 'info';
logger.transports.file.file = logPath;
logger.transports.file.size = 5 * 1024 * 1024; // 5MB.
logger.transports.file.streamConfig = { flags: "a" };

var client, modal, progress = 0;

function proCallback( amount ) {
  progress += parseInt( amount );
  $( "#progress" ).html( progress );
  if( progress === 100 ) {
    progress = 0;
    console.info( "Finished loading." );
    window.setTimeout( `$( "#loadingText" ).html( "Finished; one moment." )`, 50 );
    window.setTimeout( `modal.style.display="none";$( "#progress" ).html( 0 )`, 1000 );
  }
}

function initModalKeyHandling( modal ) {
  var controls = modal.querySelectorAll( "select, input, textarea, button, a" );
  console.info( controls );
  var first;
  var last;

  if( controls.length === 1 ) {
    first = controls[ 0 ];
    last = controls[ 0 ];
  }
  else {
    first = controls[ 0 ];
    last = controls[ controls.length - 1 ];
  }

  first.addEventListener( "keydown", function( event ) {
    if( event.key === "Tab" && event.shiftKey ) {
      event.stopPropagation();
      event.preventDefault();
      last.focus();
    }
  });

  last.addEventListener( "keydown", function( event ) {
    if( event.key === "Tab" && event.shiftKey === false ) {
      event.stopPropagation();
      event.preventDefault();
      first.focus();
    }
  });
}

String.prototype.toCapitalCase = function() {
  return this.charAt( 0 ).toUpperCase() + this.slice( 1 ).toLowerCase();
}

/* Private internal functions... */

function addOption( list, data, val ) {
  var op = document.createElement( "option" );
  if( val !== undefined ) {
    op.value = val;
  }
  op.appendChild( document.createTextNode( data ));
  list.appendChild( op );
}

function genList( list, array, vals ) {
  list.length = 0;
  for( var i = 0; i < array.length; i++ ) {
    if( vals !== undefined ) {
      addOption( list, array[ i ], vals[ i ]);
    }
    else {
      addOption( list, array[ i ]);
    }
  }
}

function getUserIndex( accountName ) {
  for( var i = 0; i < client.settings.loginusers.length; i++ ) {
    if( client.settings.loginusers[ i ].accountName === accountName ) {
      return i;
    }
  }

  throw new Error( `Couldn't find ${ accountName }.` );
};

function changeSettingsTab( toTab ) {
  var buttons = document.querySelectorAll( "#settingsMenu button" );
  var tabs = document.querySelectorAll( "div.settingsTab" );

  for( var x = 0; x < buttons.length; x++ ) {
    if( buttons[ x ].id.indexOf( toTab ) === 3 ) {
      buttons[ x ].classList.remove( "w3-black" );
      buttons[ x ].classList.add( "w3-gray" );
    }
    else {
      buttons[ x ].classList.remove( "w3-gray" );
      buttons[ x ].classList.add( "w3-black" );
    }
  }

  for( x = 0; x < tabs.length; x++ ) {
    if( tabs[ x ].id.indexOf( toTab ) === 3 ) {
      tabs[ x ].style.display = "block";
    }
    else {
      tabs[ x ].style.display = "none";
    }
  }
}

function updateVolume( forWhat, withVal ) {
  var per = Math.floor( withVal / 255 * 100 );
  if( forWhat === "receive" ) {
    $( "#asVoiceVolumeValue" ).html( per );
  }
  else if( forWhat === "music" ) {
    $( "#asMusicVolumeValue" ).html( per );
  }
}

function toValveKeyCode( key ) {
  if( key === "[" ) {
    return "KEY_LBRACKET";
  }
  else if( key === "]" ) {
    return "KEY_RBRACKET";
  }
  else if( key === " " ) {
    return "KEY_SPACE";
  }
  else if( key === "/" ) {
    return "KEY_SLASH";
  }
  else if( key === "\\" ) {
    return "KEY_BACKSLASH";
  }
  else if( key === "," ) {
    return "KEY_COMMA";
  }
  else if( key === "." ) {
    return "KEY_PERIOD";
  }
  else if( key === ";" ) {
    return "KEY_SEMICOLON";
  }
  else if( key === "'" ) {
    return "KEY_APOSTROPHE";
  }
  else if( key === "-" ) {
    return "KEY_MINUS";
  }
  else if( key === "=" ) {
    return "KEY_NONE";
    /*
      if( os.platform().indexOf( "darwin" ) !== -1 ) {
        retVal = "None";
      }
    */
  }
  else if( key === "`" ) {
    return "KEY_BACKQUOTE";
  }
  else if( key === "ArrowUp" ) {
    return "KEY_UP";
  }
  else if( key === "ArrowDown" ) {
    return "KEY_DOWN";
  }
  else if( key === "ArrowLeft" ) {
    return "KEY_LEFT";
  }
  else if( key === "ArrowRight" ) {
    return "KEY_RIGHT";
  }
  else {
    return "KEY_" + key.toUpperCase();
  }
};

function handleKeyPress( event ) {
  event.stopPropagation();
  event.preventDefault();

  var sk = ( event.shiftKey ? "Shift" : "" );
  var ck = ( event.ctrlKey ? "Ctrl" : "" );
  var ak = ( event.altKey ? "Alt" : "" );
  var mk = ( event.metaKey ? "Win" : "" );
  var key = ( event.key && event.key !== "Meta" && event.key !== "Shift" && event.key !== "Control" && event.key !== "Alt" ? event.key : "" ) || "";
  var valveKey;
  var value = [];

   if( key !== "" ) {
     valveKey = toValveKeyCode( key );
   }

   if( key === " " ) {
     key = "SPACE";
   }

   if( new RegExp( /[a-z]/ ).test( key )) {
     key = key.toUpperCase();
   }

  [ ck, ak, sk, mk ].forEach( function( item ) {
    if( item !== "" ) {
      value.push( item );
    }
  });
  if( key ) {
    $( "#" + event.currentTarget.id ).val(( value.length > 0 ? value.join( "+" ) + "+" : "" ) + ( key !== "" ? key.toCapitalCase() : "" ));
    if( valveKey !== undefined ) {
      document.getElementById( event.currentTarget.id ).setAttribute( "data-keys", value.join( "\t" ) + "\t" + valveKey );
    }
  }
}

function analyzeState( state ) {
  var maybe = "Maybe";
  var ok = "Okay";
  var no = "Useless";

  if( state === "4" ) {
    return [ ok, "Installed; ready to play" ];
  }
  else if( state === "6" ) {
    return [ maybe, "Installed; update available; may be playable without update" ];
  }
  else if( state === "1538" ) {
    return [ no, "Installing (hasn't been installed); download paused" ];
  }
  else if ( state === "1542" ) {
    return [ maybe, "Installed; updating; download paused" ];
  }
  else {
    return [ no, "Unknown state" ];
  }
}

function analyzeAUB( val ) {
  if( val === "0" ) {
    return "Automatically";
  }
  else if( val === "1" ) {
    return "When launched";
  }
  else {
    return "Automatically - High priority";
  }
}

function analyzeDLAndPlay( val ) {
  if( val === "1" ) {
    return "Yes";
  }
  return "No";
}

function updateCommonDataUI() {
  $( "#chosenPath" ).html( client.steamPath );

  genList( document.getElementById( "loginUsersList" ), client.getUserNames());
  genList( document.getElementById( "autoloadUserList" ), client.getUserNames());

  $( "#numUsers" ).html( document.getElementById( "loginUsersList" ).options.length );
  $( "#currentUser" ).html(( client.currentUser ? client.currentUser.accountName : "N/A" ));
  $( "#autologinUser" ).html( client.settings.registry.alUser );

  $( "#usDontSave" ).attr( "checked", ( client.settings.config.forgetMe === "1" ? true : false ));
  $( "#usDesktopAuth" ).attr( "checked", ( client.settings.config.authBrowserFromClient === "1" ? true : false ));

  $( "#dsAutoUpdateLimit" ).attr( "checked", ( client.settings.config.limitAUToRange === "1" ? true : false ));
  $( "#dsAllowDuringGameplay").attr( "checked", ( client.settings.config.dlAndPlay === "1" ? true : false ));
  $( "#dsStreamingThrottle").attr( "checked", ( client.settings.config.throttleDLWhileStreaming === "1" ? true : false ));
  document.getElementById( "dsAutoUpdateLimitMin" ).selectedIndex = client.settings.config.autoUpdateRangeStart;
  document.getElementById( "dsAutoUpdateLimitMax" ).selectedIndex = client.settings.config.autoUpdateRangeEnd;
  document.getElementById( "dsBandwidthLimit" ).selectedIndex = client.settings.config.maxDL;

  var pings = client.settings.config.maxPings;
  var mp = document.getElementById( "osMaxPings" );
  for( var i = 0; i < mp.options.length; i++ ) {
    if( mp.options[ i ].value === pings ) {
      mp.selectedIndex = i;
      break;
    }
  }

  var langList = document.getElementById( "isLanguage" );
  for( var i = 0; i < langList.length; i++ ) {
    if( langList.options[ i ].value === client.settings.registry.language ) {
      langList.selectedIndex = i;
      break;
    }
  }

  var sl = document.getElementById( "isSkinList" );
  genList( sl, client.skins );
  $( "#numSkins" ).html( sl.options.length );

  if( client.settings.registry.skin === "" ) {
    sl.selectedIndex = 0;
  }
  else {
    for( var i = 0; i < sl.options.length; i++ ) {
      if( sl.options[ i ].text === client.settings.registry.skin ) {
        sl.selectedIndex = i;
        break;
      }
    }
  }

  var appKeys = Object.keys( client.settings.steamapps );
  var appNames = client.getAppNames();
  var al = document.getElementById( "appList" );
  al.length = 0;
  genList( al, appNames, appKeys );
  $( "#numApps" ).html( document.getElementById( "appList" ).options.length );

  genList( document.getElementById( "blacklist" ), client.getBlacklistedAppNames());
  $( "#numBlacklisted" ).html( document.getElementById( "blacklist" ).options.length );

  genList( document.getElementById( "libList" ), client.settings.libraryfolders );
  $( "#numLibs" ).html( document.getElementById( "libList" ).options.length );

  genList( document.getElementById( "autoloadUserList" ), client.getUserNames());

  $( "#asMusicVolume" ).val( client.settings.localconfig.vrVol );
  updateVolume( "music", client.settings.localconfig.vrVol );

  if( config.has( "autoload" )) {
    var al = config.get( "autoload" );
    if( al.autoloadOnStart ) {
      $( "#doAutoLoadOnStart" ).attr( "checked", al.autoloadOnStart );
    }
    if( al.user ) {
      if( client.getUserNames().includes( al.user )) {
        document.getElementById( "autoloadUserList" ).selectedIndex = getUserIndex( al.user );
        $( "#autoloadCurrent" ).html( al.user );
      }
      else {
        console.info( `Can't find autoload user "${ al.user }" in users: ${ client.getUserNames()} to update UI.` );
      }
    }
    if( al.steam ) {
      client.steamPath = al.steam;
    }
  }
}

function updateUserDataUI() {
  $( "#usRememberPassword" ).attr( "checked", ( client.currentUser.rememberPassword === "1" ? true : false ));
  $( "#usWantsOffline" ).attr( "checked", ( client.currentUser.wantsOffline === "1" ? true : false ));
  $( "#usSkipWarning" ).attr( "checked", ( client.currentUser.skipWarning === "1" ? true : false ));
  $( "#userDisplayName" ).html( `${ client.settings.loginusers[ getUserIndex( client.currentUser.accountName )].displayName }` );

  var fw = document.getElementById( "isFavoriteWindow" );

  for( var i = 0; i < fw.options.length; i++ ) {
    if( fw.options[ i ].value === client.settings.sharedconfig.favoriteWindow ) {
      fw.selectedIndex = i;
      break;
    }
  }

  var frs = document.getElementById( "fsState" );
  for( var i = 0; i < frs.options.length; i++ ) {
    if( frs.options[ i ].value === client.settings.localconfig.status ) {
      frs.selectedIndex = i;
      break;
    }
  }

  updateVolume( "receive", client.settings.localconfig.vrVol );
  $( "#asVoiceVolume" ).val( client.settings.localconfig.vrVol );

  $( "#isNotifyNews" ).attr( "checked", ( client.settings.localconfig.showNewsOnStart === "1" ? true : false ));
  $( "#isAddressBar" ).attr( "checked", ( client.settings.localconfig.navBar === "1" ? true : false ));

  $( "#fsJoinNotification" ).attr( "checked", ( client.settings.localconfig.joinToast === "1" ? true : false ));
  $( "#fsJoinSound" ).attr( "checked", ( client.settings.localconfig.joinSound === "1" ? true : false ));
  $( "#fsOnlineNotification" ).attr( "checked", ( client.settings.localconfig.onlineToast === "1" ? true : false ));
  $( "#fsOnlineSound" ).attr( "checked", ( client.settings.localconfig.onlineSound === "1" ? true : false ));
  $( "#fsMessageNotification" ).attr( "checked", ( client.settings.localconfig.messageToast === "1" ? true : false ));
  $( "#fsMessageSound" ).attr( "checked", ( client.settings.localconfig.messageSound === "1" ? true : false ));
  $( "#fsGroupNotification" ).attr( "checked", ( client.settings.localconfig.groupToast === "1" ? true : false ));
  $( "#fsGroupSound" ).attr( "checked", ( client.settings.localconfig.groupSound === "1" ? true : false ));
  $( "#fsOverlay" ).attr( "checked", ( client.settings.localconfig.olFriends === "1" ? true : false ));
  $( "#fsShowOnStart" ).attr( "checked", ( client.settings.localconfig.showFriendsOnStart === "1" ? true : false ));
  $( "#fsAutoSign" ).attr( "checked", ( client.settings.localconfig.autoSignInFriends === "1" ? true : false ));
  document.getElementById( "fsFlashWindow" ).selectedIndex = client.settings.localconfig.flashWin;

  $( "#osEnableOverlay" ).attr( "checked" , ( client.settings.localconfig.enableOverlay === "1" ? true : false ));
  $( "#osScreenshotNotification" ).attr( "checked", ( client.settings.localconfig.overlaySSToast === "1" ? true : false ));
  $( "#osScreenshotSound" ).attr( "checked", ( client.settings.localconfig.overlaySSSound === "1" ? true : false ));
  $( "#osScreenshotOriginal" ).attr( "checked", ( client.settings.localconfig.overlaySSUncompressed === "1" ? true : false ));
  $( "#osScreenshotKeys" ).val( client.settings.localconfig.overlaySSKey );
  $( "#osOverlayKeys" ).val( client.settings.localconfig.overlayKeys );
  $( "#osHomePage" ).val( client.settings.localconfig.overlayHome );
  $( "#osOverlayContrastFPS" ).attr( "checked", ( client.settings.localconfig.overlayFPSContrast === "1" ? true : false ));
  document.getElementById( "osOverlayFPSCorner" ).selectedIndex = client.settings.localconfig.overlayFPSCorner;

  $( "#asPushTalk" ).attr( "checked", ( client.settings.localconfig.usePTT === "1" ? true : false ));
  $( "input[ name='autoVoice' ][ value='" + !!+client.settings.localconfig.usePTT + "' ]" ).attr( "checked", true );
  $( "#asPTKey" ).html( client.settings.localconfig.pttKey );

  $( "#dsRatesAsBits" ).attr( "checked", ( client.settings.localconfig.displayAsBits === "1" ? true : false ));
}

function updateUI() {
  updateCommonDataUI();
  if( client.currentUser !== undefined && JSON.stringify( client.currentUser ) !== "{}" ) {
    updateUserDataUI();
  }
  $( "#loaded" ).html( "Loaded" );
  initFiltering();
};

function initFiltering() {
  /* Code based on
   *   http://www.lessanvaezi.com/filter-select-list-options/
   */
  $.fn.filterByText = function( textbox, selectSingleMatch ) {
    return this.each( function() {
      var select = this;
      var options = [];
      $(select).find('option').each(function() {
        options.push({value: $(this).val(), text: $(this).text()});
      });
      $(select).data('options', options);
      $(textbox).bind('change keyup', function() {
        options = $(select).empty().scrollTop(0).data('options');
        var search = $.trim($(this).val());
        var regex = new RegExp(search,'gi');

        $.each(options, function(i) {
          var option = options[i];
          if(option.text.match(regex) !== null) {
            $(select).append(
              $('<option>').text(option.text).val(option.value)
           );
         }
        });
        if( textbox[ 0 ].id === "searchSteamapps" ) {
          $( "#numApps" ).text( $(select).children().length );
        }
        else if( textbox[ 0 ].id === "searchCatApps" ) {
          $( "#catApps" ).text( $( select ).children().length );
        }
        else if( textbox[ 0 ].id === "searchLibs" ) {
          $( "#numLibs" ).text( $( select ).children().length );
        }
      });
    });
  };

  $( function() {
    $( '#appList' ).filterByText( $( '#searchSteamapps' ));
  });

  $( function() {
    $( '#catAppsList' ).filterByText( $( '#searchCatApps' ));
  });

  $( function() {
    $( '#libList' ).filterByText( $( '#searchLibs' ));
  });
}

function handleKeyForModal( ev ) {
  if( ev.key === "Escape" ) {
    $( "#modalBackups" ).css( "display", "none" );
  }
}

function anchorHandler( event ) {
  if( event.target.href.indexOf( "javascript:void" ) === -1 ) {
    console.info( event.target.href );
    if( ! dialog.showMessageBox( null,
      { type: "question",
        title: "Open external link?",
        message: `Do you want to open\n${event.target.href}\nin your browser?`,
        buttons: [ "Yes", "No" ],
        noLink: true
    })) {
      shell.openExternal( event.target.href );
    }
  }
  event.preventDefault();
  return false;
}

async function loadAutoConfig() {
  var autoConfig;
  if( config.has( "autoload" )) {
    autoConfig = config.get( "autoload" );
    if( autoConfig.autoloadOnStart ) {
      var user = autoConfig.user;
      var steam = autoConfig.steam;

      modal = document.getElementById( "modalProgress" );
      modal.style.display = "block";

      console.info( `Auto loading (with user) from ${ autoConfig.steam }` );

      $( "#loadingText" ).html( "Auto-loading; please wait." );


      client.steamPath = autoConfig.steam;
      await client.loadCommonData( autoConfig.steam, proCallback );
      client.setUser( autoConfig.user );
      await client.loadUserData( autoConfig.steam, proCallback, false );

      updateUI();
    }
  }
}

function loadAppConfig() {
  var winConfig;
  if( config.has( "window" )) {
    winConfig = config.get( "window" );
    appWin.setSize( winConfig.width, winConfig.height );
    appWin.setPosition( winConfig.x, winConfig.y, false );
  }

  loadPersonalSettings();
}

function saveWinConfig() {
  var winSize = appWin.getSize();
  var winPosition = appWin.getPosition();
  var winConfig = {
    width: winSize[ 0 ],
    height: winSize[ 1 ],
    x: winPosition[ 0 ],
    y: winPosition[ 1 ]
  };
  config.set( "window", winConfig );
}

function showAppTab( btn ) {
  btn.blur();
  if( btn.classList.contains( "w3-gray" ) === false ) {
    btn.classList.add( "w3-gray" );
  }
  var tab = document.getElementById( "container" + btn.id.substring( 4 ));
  var allTabs = document.getElementsByClassName( "aTab" );
  tab.style.display = "block";
  for( var i = 0; i < allTabs.length; i++ ) {
    var item = allTabs[ i ];
    if( item.id !== tab.id ) {
      item.style.display = "none";
      document.getElementById( "menu" + item.id.substring( 9 )).classList.remove( "w3-gray" );
    }
  }
}

function showDataTab( btn ) {
  btn.blur();
  if( btn.classList.contains( "w3-gray" ) === false ) {
    btn.classList.add( "w3-gray" );
  }
  var tab = document.getElementById( "data" + btn.id.substring( 7 ));
  var allTabs = document.getElementsByClassName( "dTab" );

  tab.style.display = "block";
  for( var i = 0; i < allTabs.length; i++ ) {
    var item = allTabs[ i ];
    if( item.id !== tab.id ) {
      item.style.display = "none";
      document.getElementById( "submenu" + item.id.substring( 4 )).classList.remove( "w3-gray" );
    }
  }
}

function showClientSettingsTab( btn ) {
  btn.classList.add( "w3-gray" );
  var tab = document.getElementById( btn.id.substring( 0, btn.id.indexOf( "Btn" )) + "Tab" );
  var allTabs = document.getElementsByClassName( "csTab" );
  tab.style.display = "block";
  for( var i = 0; i < allTabs.length; i++ ) {
    var item = allTabs[ i ];
    if( item.id !== tab.id ) {
      item.style.display = "none";
      document.getElementById( item.id.substring( 0, item.id.indexOf( "Tab" )) + "Btn"  ).classList.remove( "w3-gray" );
    }
  }
}

function loadPersonalSettings() {
  var appSettings;
  var bgList = document.getElementById( "bgSettingsList" );
  var bgSolidSet = document.getElementById( "bgSettingsSolid" );
  var bgImageSet = $( "#bgSettingsImageCurrent" );
  var textColorSet = document.getElementById( "textSettingsColor" );
  var bgImage = document.body;
  var startupTab = document.getElementById( "startupTab" );

  if( config.has( "personal" )) {
    appSettings = config.get( "personal" );
  }
  else {
    appSettings = {
      background: 0,
      bgColor: "#000000",
      bgImage: "",
      textColor: "#FFFFFF",
      startTab: 4
    };
  }

  bgList.selectedIndex = appSettings.background;
  var evt = document.createEvent( "HTMLEvents" );
    evt.initEvent( "change", false, true );
    bgList.dispatchEvent( evt );
  bgSolidSet.value = appSettings.bgColor || "#000000";
  bgImageSet.text( appSettings.bgImage );
  textColorSet.value = appSettings.textColor || "#FFFFFF";
  startupTab.selectedIndex = appSettings.startTab;

  applyPersonalSettings( appSettings.background, appSettings.bgColor, appSettings.bgImage, appSettings.textColor, appSettings.startTab );
}

function applyPersonalSettings( bgOption, bgSolidVal, bgImageVal, textColorVal, startTab ) {
  console.info( "Applying app settings..." );
  var bgImage = document.body;

  // console.info( `Setting: ${ bgList.options[ bgOption ].text }\n\tSolid background: ${ bgSolidVal }\n\tBackground image: ${ bgImageVal || "N/A" }\n\tText color: ${ textColorVal }\n\tCurrent BG image: ${ bgImage.style.backgroundImage || "N/A" }` );

  switch( bgOption ) {
    case 0:
      console.info( "Changing to default background..." );
      document.body.style[ "background-color" ] = "";
      bgImage.style.backgroundImage = "";
    break;
    case 1:
      console.info( `Changing to solid color background... ${ bgSolidVal }` );
      document.body.style[ "background-color" ] = bgSolidVal;
      bgImage.style.backgroundImage = undefined;
    break;
    case 2:
      console.info( "Changing to image background..." );
      document.body.style[ "background-color" ] = undefined;
      if( os.platform === "win32" ) {
        bgImage.style.backgroundImage = JSON.stringify( bgImageVal.substring( value.indexOf( "file:///" )));
      }
      else {
        bgImage.style.backgroundImage = "url( " + bgImageVal + " )";
      }
    break;
    default:
      alert( "Make a change to the settings first." );
    break;
  }

  document.body.style.color = textColorVal;


  /*
        <option>Apps/Public App Controls</option>
        <option>Apps/Private App Controls</option>
        <option>Apps/Blacklist</option>
        <option>Client</option>
        <option>Settings</option>
  */

  if( $( "#modalAppSettings" ).css( "display" ) !== "block" ) {
    switch( startTab ) {
      case 0:
        $( "#menuData" ).click();
        break;
      case 1:
        $( "#menuData" ).click();
        $( "#submenuUsers" ).click();
        break;
      case 2:
        $( "#menuData" ).click();
        $( "#submenuLibraries" ).click();
        break;
      case 3:
        $( "#menuData" ).click();
        $( "#submenuApps" ).click();
        break;
      case 4:
        $( "#menuData" ).click();
        $( "#submenuBlacklist" ).click();
        break;
      case 5:
        $( "#menuClient" ).click();
        break;
      case 6:
        $( "#menuSettings" ).click();
        break;
    }
  }
}

function showSelectedLibs() {
  var libs = [];
  var apps = {};
  var appKeys = Object.keys( client.settings.steamapps );
  var appNames = [];
  var libList = document.getElementById( "libList" );
  var al = document.getElementById( "appList" );

  for( var x = 0; x < libList.options.length; x++ ) {
    if( libList.options[ x ].selected === true ) {
      libs.push( libList.options[ x ].text );
    }
  }

  for( var x = 0; x < libs.length; x++ ) {
    for( var y = 0; y < appKeys.length; y++ ) {
      if( client.settings.steamapps[ appKeys[ y ]].library === libs[ x ]) {
        apps[ client.settings.steamapps[ appKeys[ y ]].appid ] = client.settings.steamapps[ appKeys[ y ]];
        appNames.push( client.settings.steamapps[ appKeys[ y ]].name );
      }
    }
  }

  appKeys = Object.keys( apps );

  al.length = 0;

  genList( al, appNames, appKeys );

  $( "#numApps" ).html( appKeys.length );

  initFiltering();
}

function handleResize() {
  if( window.innerWidth < 601 ) {
    $( "#userList" ).attr( "size", "3" );
    $( "#appList" ).attr( "size", "3" );
    $( "#appBlacklist" ).attr( "size", "4" );
    $( "#helpList" ).attr( "size", "4" );
  }
  else if( window.innerWidth > 600 ) {
    $( "#userList" ).attr( "size", "5" );
    $( "#appList" ).attr( "size", "20" );
    $( "#appBlacklist" ).attr( "size", "20" );
    $( "#helpList" ).attr( "size", "25" );
  }
}

function initEventHandlers() {
  $( "#choose" ).click( function() {
    var chosen = dialog.showOpenDialog({
      title: "Select your Steam installation folder",
      properties: [ 'openDirectory' ],
      defaultPath: client.getDefaultLocation()
    });

    if( chosen[ 0 ] === undefined ) {
      alert( "You must choose a Steam location before you can continue." );
    }
    else {
      chosen = chosen[ 0 ];
    }

    if( os.platform().indexOf( "linux" ) === -1 && nfs.existsSync( path.join( chosen, "config", "loginusers.vdf" )) === false ) {
      alert( "Invalid path, or Steam may not be properly installed to the chosen path." );
    }
    else if( os.platform().indexOf( "linux" ) !== -1 && nfs.existsSync( path.join( chosen, "steam", "config", "loginusers.vdf" )) === false ) {
      alert( "Invalid path, or Steam may not be properly installed to the chosen path." );
    }
    else {
      client.steamPath = chosen;
      $( "#chosenPath" ).html( chosen );
    }
  });

  $( "#load" ).click( async function doLoading() {
    if( client.steamPath === "" ) {
      alert( "Set the path to Steam first." );
    }
    else {
      modal = document.getElementById( "modalProgress" );
      modal.style.display = "block";

      console.info( "Loading Steam..." );

      $( "#loadingText" ).html( "Loading; please wait." );

      await client.loadSteam( client.steamPath, proCallback );
    }
    updateUI();
  });

  $( "#offline" ).click( function() {
    if( Client.currentUser === undefined ) {
      alert( "You must set a user before you can set offline mode." );
    }
    else {
      var mode = "0";
      var skip = "0";
      mode = ( document.getElementById( "wantsOffline" ).checked ? "1" : "0" );
      skip = ( document.getElementById( "skipWarning" ).checked ? "1" : "0" );

      Client.currentUser.wantsOffline = mode;
      Client.currentUser.skipWarning = skip;
      document.getElementById( "wantsOffline" ).checked = !!+mode;
      document.getElementById( "skipWarning" ).checked = !!+skip;
      $( "#offlineConfig" ).html( `Current: ${Client.currentUser.wantsOffline} & ${Client.currentUser.skipWarning}.` );
    }
  });

  $( "#skinSet" ).click( function() {
    var skins = document.getElementById( "skinList" );
    var skin = skins.selectedIndex;
    if( skin !== undefined ) {
      $( "#currentSkin" ).html( skins.options[ skins.selectedIndex ].text );
    }
  });

  $( "#btnMain" ).click( function() {
    changeSettingsTab( "Main" );
  });

  $( "#btnConfig" ).click( function() {
    changeSettingsTab( "Config" );
  });

  $( "#btnLoginUsers" ).click( function() {
    changeSettingsTab( "LoginUsers" );
  });

  $( "#btnRegistry" ).click( function() {
    changeSettingsTab( "Registry" );
  });

  $( "#btnSteamapps" ).click( function() {
    changeSettingsTab( "Steamapps" );
  });

  $( "#btnSharedConfig" ).click( function() {
    changeSettingsTab( "SharedConfig" );
  });

  $( "#btnLocalConfig" ).click( function() {
    changeSettingsTab( "LocalConfig" );
  });

  $( "#asVoiceVolume" ).change( function changeVoiceVolume( event ) {
    updateVolume( "receive", event.currentTarget.value );
  });

  $( "#asMusicVolume" ).change( function changeMusicVolume( event ) {
    updateVolume( "music", event.currentTarget.value );
  });

  $( "#overlayKeys" ).keydown( function( event ) {
    handleKeyPress( event );
  });

  $( "#overlayKeys" ).keyup( function( event ) {
    event.stopPropagation();
    event.preventDefault();
  });

  $( "#screenshotKeys" ).keydown( function( event ) {
    handleKeyPress( event );
  });

  $( "#screenshotKeys" ).keyup( function( event ) {
    event.stopPropagation();
    event.preventDefault();
  });

  $( "#pttKey" ).keydown( function( event ) {
    event.stopPropagation();
    event.preventDefault();
  });

  $( "#pttKey" ).keyup( function( event ) {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.value = `Random: ${ Math.floor( Math.random() * 100 )}`;
  });

  $( "#appList" ).change( function( event ) {
    var al = event.currentTarget;
    var appid = al.options[ al.selectedIndex ].value;
    var scAppKeys = ( JSON.stringify( client.settings.sharedconfig ) !== "{}" ? Object.keys( client.settings.sharedconfig.apps ) : []);
    $( "#steamappsName" ).html( al.options[ al.selectedIndex ].text );
    var sasAnalysis = analyzeState( client.settings.steamapps[ appid ].state );
    $( "#steamappsState" ).html( `${ sasAnalysis[ 0 ]} (${ client.settings.steamapps[ appid ].state })` );
    $( "#steamappsState" ).attr( "title", sasAnalysis[ 1 ]);
    $( "#steamappsInstallDir" ).html( client.settings.steamapps[ appid ].installDir );
    $( "#steamappsSize" ).html( `${ Measure.toStringByteSize( client.settings.steamapps[ appid ].sizeInBytes )}` );
    $( "#steamappsDownloadedAmount" ).html( `${ Measure.toStringByteSize( client.settings.steamapps[ appid ].bytesDownloaded )}` );
    $( "#steamappsDownloadSize" ).html( `${ Measure.toStringByteSize( client.settings.steamapps[ appid ].sizeToDownload )}` );
    $( "#steamappsLastUpdated" ).html(
      ( client.settings.steamapps[ appid ].lastUpdated === "0" ?
        "Never" :
        `${ Measure.timeSince( client.settings.steamapps[ appid ].lastUpdated )}`
      )
    );
    $( "#steamappsLastUpdated" ).html(  );
    $( "#steamappsAUB" ).html( analyzeAUB( client.settings.steamapps[ appid ].aub ));
    $( "#steamappsCanDL" ).html( analyzeDLAndPlay( client.settings.steamapps[ appid ].dlAndPlay ));
    $( "#steamappsSavefiles" ).html((
        scAppKeys.includes( appid ) &&
        client.settings.sharedconfig.apps[ appid ].appinfo.saves !== undefined &&
        client.settings.sharedconfig.apps[ appid ].appinfo.saves !== "" ?
        "Yes" :
        "No"
      )
    );
    $( "#pcgwLink" ).attr( "href", `https://pcgamingwiki.com/api/appid.php?appid=${ appid }` );

    var appidNode = document.getElementById( "steamappsAppid" );
    while( appidNode.firstChild ) {
      appidNode.removeChild( appidNode.firstChild );
    }
    var storeLink = document.createElement( "a" );
    storeLink.href = `http://store.steampowered.com/app/${appid}/`;
    storeLink.onclick = anchorHandler;
    storeLink.appendChild( document.createTextNode( appid ));
    appidNode.appendChild( storeLink );


    var app = ( client.settings.sharedconfig.apps.hasOwnProperty( appid ) ?
                client.settings.sharedconfig.apps[ appid ] : {}
        );
    if( app !== {} ) {
      var tags = ( app.tags !== undefined ? Object.values( app.tags ) : []);

      $( "#appCats" ).html( tags.length );
      $( "#appCatsBox" ).val( tags.join( ", " ));
      $( "#appController" ).html(( app.appinfo && app.appinfo.controller && app.appinfo.controller !== "" ? app.appinfo.controller : "N/A" ));
      $( "#appMetacritic" ).html(( app.appinfo && app.appinfo.metacritic && app.appinfo.metacritic !== "" ? app.appinfo.metacritic : "N/A" ));
      $( "#appDeveloper" ).html(( app.appinfo && app.appinfo.developer && app.appinfo.developer !== "" ? app.appinfo.developer : "N/A" ));
      $( "#appPublisher" ).html(( app.appinfo && app.appinfo.publisher && app.appinfo.publisher !== "" ? app.appinfo.publisher : "N/A" ));
    }
  });

  $( "#btnManager" ).click( function() {
    $( "#modalBackups" ).css( "display", "block" );
  });

  $( "#closemodalBackups" ).click( function() {
    $( "#modalBackups" ).css( "display", "none" );
  });

  $( "#cancelmodalBackups" ).click( function() {
    $( "#modalBackups" ).css( "display", "none" );
  });

  $( "#okaymodalBackups" ).click( function() {
    $( "#modalBackups" ).css( "display", "none" );
  });

  $( "#pcgwLink" ).click( anchorHandler );

  $( "#clientSettings" ).click( function showClientSettings() {
    $( "#clientSettingsModal" ).css( "display", "block" );
  });

  $( "#userSettingsBtn" ).click( function( event ) {
    showClientSettingsTab( event.currentTarget );
  });

  $( "#dlSettingsBtn" ).click( function( event ) {
    showClientSettingsTab( event.currentTarget );
  });

  $( "#friendsSettingsBtn" ).click( function( event ) {
    showClientSettingsTab( event.currentTarget );
  });

  $( "#audioSettingsBtn" ).click( function( event ) {
    showClientSettingsTab( event.currentTarget );
  });

  $( "#overlaySettingsBtn" ).click( function( event ) {
    showClientSettingsTab( event.currentTarget );
  });

  $( "#interfaceSettingsBtn" ).click( function( event ) {
    showClientSettingsTab( event.currentTarget );
  });

  $( "#menuToggle" ).click( function( event ) {
    var mi = document.getElementsByClassName( "menu-items" )[ 0 ];
    var om = document.getElementById( "otherMenu" );

    if( mi.style.display !== "none" ) {
      mi.style.display = "none";
      event.currentTarget.innerHTML = "&#9776;";
      om.style.display = "inline-block";
    }
    else if( mi.style.display === "none" ) {
      mi.style.display = "inline-block";
      event.currentTarget.innerHTML = "&times;";
      om.style.display = "none";
    }

    event.currentTarget.blur();
  });

  $( "#menuData" ).click( function( event ) {
    showAppTab( event.currentTarget );
  });

  $( "#menuClient" ).click( function( event ) {
    showAppTab( event.currentTarget );
  });

  $( "#menuSettings" ).click( function( event ) {
    showAppTab( event.currentTarget );
  });

  $( "#menuHelp" ).click( function( event ) {
    showAppTab( event.currentTarget );
  });

  $( "#menuAbout" ).click( function( event ) {
    showAppTab( event.currentTarget );
  });

  $( "#menuExit" ).click( function( event ) {
    window.close();
  });

  $( "#submenuUsers" ).click( function( event ) {
    showDataTab( event.currentTarget );
  });

  $( "#submenuLibraries" ).click( function( event ) {
    showDataTab( event.currentTarget );
  });

  $( "#submenuApps" ).click( function( event ) {
    showDataTab( event.currentTarget );
  });

  $( "#submenuBlacklist" ).click( function( event ) {
    showDataTab( event.currentTarget );
  });

  $( "#switchToBlacklist" ).click( function() {
    $( "#displayApps" ).css( "display", "none" );
    $( "#displayAppControls" ).css( "display", "none" );
    $( "#displayBlacklist" ).css( "display", "block" );
    $( "#displayBlacklistControls" ).css( "display", "block" );
  });

  $( "#switchToAppsList" ).click( function() {
    $( "#displayApps" ).css( "display", "block" );
    $( "#displayAppControls" ).css( "display", "block" );
    $( "#displayBlacklist" ).css( "display", "none" );
    $( "#displayBlacklistControls" ).css( "display", "none" );
  });

  $( "#switchToPublicAppControls" ).click( function() {
    $( "#displayPublicAppControls" ).css( "display", "block" );
    $( "#displayPrivateAppControls" ).css( "display", "none" );
  });

  $( "#switchToPrivateAppControls" ).click( function() {
    $( "#displayPublicAppControls" ).css( "display", "none" );
    $( "#displayPrivateAppControls" ).css( "display", "block" );
  });

  $( "#launchOptions" ).click( function() {
    $( "#launchOptionsModal" ).css( "display", "block" );
  });

  $( "#bgSettingsList" ).change( function( event ) {
    var list = document.getElementById( "bgSettingsList" );
    var changeTo = list.options[ list.selectedIndex ].text;

    if( changeTo !== "Default" ) {
      if( changeTo === "Solid" ) {
        $( "#bgSettingsSolidContainer" ).css( "display", "block" );
        $( "#bgSettingsImageContainer" ).css( "display", "none" );
      }
      else if( changeTo === "Image" ) {
        $( "#bgSettingsSolidContainer" ).css( "display", "none" );
        $( "#bgSettingsImageContainer" ).css( "display", "block" );
      }
    }
    else {
      $( "#bgSettingsSolidContainer" ).css( "display", "none" );
      $( "#bgSettingsImageContainer" ).css( "display", "none" );
    }
  });

  $( "#bgSettingsImageChoose" ).click( function chooseBGImage() {
      var chosen = dialog.showOpenDialog({
        title: "Select the background image",
        properties: [ 'openFile' ]
      });

      if( chosen[ 0 ] === undefined ) {
      }
      else {
        chosen = chosen[ 0 ];
      }

      $( "#bgSettingsImageCurrent" ).text( chosen );
  });

  $( "#showLibs" ).click( showSelectedLibs );

  $( "#showAutoload" ).click( function() {
    $( "#modalAutoload" ).css( "display", "block" );
  });

  $( "#cancelAutoload" ).click( function() {
    $( "#modalAutoload" ).css( "display", "none" );
  });

  $( "#saveAutoload" ).click( function saveAutoload() {
    var alos = document.getElementById( "doAutoLoadOnStart" ),
        ul = document.getElementById( "autoloadUserList" ),
        autoConfig = {
          user: ul.options[ ul.selectedIndex ].text,
          steam: client.steamPath,
          autoloadOnStart: alos.checked || false,
        };

    config.set( "autoload", autoConfig );

    $( "#autoloadCurrent" ).html( ul.options[ ul.selectedIndex ].text );

    $( "#modalAutoload" ).css( "display", "none" );

    console.info( "Saved autoload settings." );
    console.info( autoConfig );
  });

  $( "#removeAutoload" ).click( function removeAutoloadSettings() {
    if( config.has( "autoload" )) {
      config.delete( "autoload" );
    }
  });

  $( "#showAppSettings" ).click( function showAppSettings() {
    $( "#modalAppSettings" ).css( "display", "block" );
  });

  $( "#cancelAppSettings" ).click( function cancelAppSettings() {
    $( "#modalAppSettings" ).css( "display", "none" );
  });

  $( "#applyAppSettings" ).click( function savePersonalSettings() {
    var bgOption = document.getElementById( "bgSettingsList" ).selectedIndex;
    var bgSolidVal = document.getElementById( "bgSettingsSolid" ).value;
    var bgImageVal = $( "#bgSettingsImageCurrent" ).text();
    var textColorVal = document.getElementById( "textSettingsColor" ).value;
    var startupTab = document.getElementById( "startupTab" );

    if( bgImageVal === "N/A" ) {
      bgImageVal = undefined;
    }

    var appSettings = {
      background: bgOption,
      bgColor: bgSolidVal || undefined,
      bgImage: bgImageVal || undefined,
      textColor: textColorVal || undefined,
      startTab: startupTab.selectedIndex || 0
    };

    console.info( appSettings );

    applyPersonalSettings( bgOption, bgSolidVal, bgImageVal, textColorVal, startupTab );

    config.set( "personal", appSettings );

    $( "#modalAppSettings" ).css( "display", "none" );
  });

  $( "#setAppUser" ).click( async function setSelectedUser() {
    if( client === undefined ) {
      alert( "Set the path to Steam first." );
    }
    else {
      var ul = document.getElementById( "userList" );
      var user = client.settings.loginusers[ getUserIndex( ul.options[ ul.selectedIndex ].text )];
      modal = document.getElementById( "modalProgress" );

      if( client.steamPath === undefined ) {

      }

      if( user !== undefined ) {
        modal.style.display = "block";
        $( "#loadingText" ).html( "Loading data; please wait." );
        client.setUser( user.accountName );
        await client.loadSteamPrivateData( client.steamPath, proCallback, true );
        updateUserDataUI();
      }
    }
  });

  $( "#setAutologinUser" ).click( function setAutologinUser() {
    var ul = document.getElementById( "userList" );

    if( ul.selectedIndex !== -1 ) {
      $( "#autologinUser" ).html( ul.options[ ul.selectedIndex ].text );
    }
    else {
      alert( "Select a user first." );
    }
  });

  $( "#helpList" ).change( function( event ) {
    var index = event.currentTarget.selectedIndex;
    var keys = Object.keys( help );

    if( index > 1 ) {
      index %= 2;
    }

    $( "#helpTitle" ).html( help[ keys[ index ]].title );
    $( "#helpText" ).html( help[ keys[ index ]].text );
  });

  window.addEventListener( "keydown", function( event ) {
    /* Allow Cmd + R & Cmd + Q on Mac. */
    if(( event.key !== "R" && event.meta !== true ) &&
      (  event.key !== "Q" && event.meta !== true ))
    {
      if( $( "#modalProgress" ).css( "display" ) !== "none" ) {
        event.stopPropagation();
        event.preventDefault();
      }
      else if( event.key === "Escape" ) {
        if( $( "#modalAutoload" ).css( "display" ) !== "none" ) {
          $( "#modalAutoload" ).css( "display", "none" );
        }
        else if( $( "#modalBackups" ).css( "display" ) !== "none" ) {
          $( "#modalBackups" ).css( "display", "none" );
        }
        else if( $( "#launchOptionsModal" ).css( "display" ) !== "none" ) {
          $( "#launchOptionsModal" ).css( "display", "none" );
        }
        else if( $( "#clientSettingsModal" ).css( "display" ) !== "none" ) {
          $( "#clientSettingsModal" ).css( "display", "none" );
        }
        else if( $( "#modalAutoload" ).css( "display" ) !== "none" ) {
          $( "#modalAutoload" ).css( "display", "none" );
        }
        else if( $( "#modalAppSettings" ).css( "display" ) !== "none" ) {
          $( "#modalAppSettings" ).css( "display", "none" );
        }
      }
    }
  });

  window.addEventListener( "click", function() {
    if( event.target.id === "modalBackups" ) {
      $( "#modalBackups ").css( "display", "none" );
    }
    else if( event.target.id === "clientSettingsModal" ) {
      $( "#clientSettingsModal" ).css( "display", "none" );
    }
    else if( event.target.id === "launchOptionsModal" ) {
      $( "#launchOptionsModal" ).css( "display", "none" );
    }
    else if( event.target.id === "modalBackups" ) {
      $( "#modalBackups" ).css( "display", "none" );
    }
    else if( event.target.id === "modalAppSettings" || event.target.id === "modalAutoload" ) {
      if( $( "#modalAutoload" ).css( "display" ) !== "none" ) {
        $( "#modalAutoload" ).css( "display", "none" );
      }
      else {
        $( "#modalAppSettings" ).css( "display", "none" );
      }
    }
  });

  window.addEventListener( "resize", handleResize );
}

function loadHelpData() {
  var helpKeys = Object.keys( help );
  var sel = document.getElementById( "helpList" );
  var helpPages, og, o;

  for( var x = 0; x < helpKeys.length; x++ ) {
    og = document.createElement( "optgroup" );
    og.label = helpKeys[ x ];
    sel.appendChild( og );

    for( var y = 0; y < help[ helpKeys[ x ]].length; y++ ) {
      o = document.createElement( "option" );
      o.appendChild( document.createTextNode( help[ helpKeys[ x ]][ y ].title ));
      og.appendChild( o );
    }
  }
}

function init() {
  console.info( "@init -- Not loading Steam while testing UI." );

  var toWidth = 601;
  var toHeight = 780;
  if( window.outerWidth < toWidth ) {
    window.outerWidth = toWidth;
  }
  if( window.outerHeight < toHeight ) {
    window.outerHeight = toHeight;
  }

  handleResize();

  initEventHandlers();

  loadAppConfig();

  /*

    if( config.has( "blacklist" )) {
      console.info( "Have blacklist..." );
      client = new SteamConfig.SteamConfig( config.get( "blacklist" ));
    }
    else {
      console.info( "Using default blacklist..." );
      client = new SteamConfig.SteamConfig();
    }

    loadAutoConfig();
  */
}

window.addEventListener( "DOMContentLoaded", function() {
  init();
});


/* Code from or based on
 * https://www.loggly.com/blog/node-js-error-handling/
 */

process.on( 'uncaughtException', ( err ) => {
    logger.error( 'Whoops! There was an uncaught error', err );
    // do a graceful shutdown,
    // close the database connection etc.
    process.exit( 1 );
});