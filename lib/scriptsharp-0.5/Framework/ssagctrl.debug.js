//! Script# Silverlight Bootstrapper
//! Copyright (c) 2007, Nikhil Kothari. All Rights Reserved.
//! http://projects.nikhilk.net
//!

function _SL() {
    var ua = window.navigator.userAgent;
    if ((ua.indexOf('MSIE') >= 0) || (ua.indexOf('Firefox') >= 0) || (ua.indexOf('Safari') >= 0)) {
        this.isSupported = true;
    }
    else {
        this._version = '';
    }
    window.attachEvent('onunload', _SL.cleanup);
}
_SL.count = 0;
_SL.cleanup = function() {
    for (var i = _SL.count - 1; i >= 0; i--) {
        window['__slLoad' + i] = null;
        window['__slError' + i] = null;
        window['__slProgress' + i] = null;
    }
    window.detachEvent('onunload', _SL.cleanup);
}
_SL.createHandler = function(callback) {
    return function(sender, e) {
        callback(sender, e)
    };
}
_SL.createLoadHandler = function(callback, element, context) {
    // Silverlight doesn't report things like size information
    // correctly during the load event. Delaying this just a bit
    // using window.setTimeout allows Silverlight to compute
    // the right information...
    return function() {
        window.setTimeout(function() { callback(element.childNodes[0], context); }, 0);
    };
}
_SL.onError = function(sender, e) {
    var errorBuilder = [];
    errorBuilder.push('Unhandled Silverlight Error: ' + e.errorMessage);
    errorBuilder.push('Control ID: ' + sender.id);
    errorBuilder.push('Error Code: ' + e.errorCode);
    errorBuilder.push('Error Type: ' + e.errorType);

    if (e.errorType == 'ParserError') {
        errorBuilder.push('XAML File : ' + e.xamlFile);
        errorBuilder.push('Line      : ' + e.lineNumber);
        errorBuilder.push('Position  : ' + e.charPosition);
    }
    else if (e.errorType == 'RuntimeError') {
        errorBuilder.push('Method    : ' + e.methodName);
        if (e.lineNumber) {
            errorBuilder.push('Line      : ' + e.lineNumber);
            errorBuilder.push('Position  : ' + e.charPosition);
        }
    }
    alert(errorBuilder.join('\n'));
}
_SL.prototype = {
    isSupported: false, _version: null,
    _getVersion: function() {
        if (this._version !== null) {
            return this._version;
        }
        this._version = '';
        var container = null;
        try {
            var control = null;
            if (window.ActiveXObject) {
                control = new ActiveXObject('AgControl.AgControl');
            }
            else {
                if (navigator.plugins['Silverlight Plug-In']) {
                    container = document.createElement('div');
                    document.body.appendChild(container);

                    container.innerHTML= '<embed type="application/x-silverlight" src="data:," style="width:0px;height:0px;"/>';
                    control = container.childNodes[0];
                }
            }
            if (control) {
                var versionParts = [0,0,0,0];
                for (var i = 0; i < versionParts.length; i++) {
                    for (var n = 0; n < 100000; n++) {
                        versionParts[i] = n;
                        if (!control.isVersionSupported(versionParts.join('.'))) {
                            versionParts[i] = n - 1;
                            break;
                        }
                    }
                }
                this._version = versionParts;
            }
        }
        catch (e) {
        }
        if (container) {
            document.body.removeChild(container);
        }
        return this._version;
    },
    isInstalled: function(version) {
        var existingVersion = this._getVersion();
        if (!existingVersion || (existingVersion.length == 0)) {
            return false;
        }
        if (!version) {
            return true;
        }

        var checkParts = version.split('.');
        for (var i = 0; i < 2; i++) {
            checkParts[i] = parseInt(checkParts[i]);
        }

        if (existingVersion[0] > checkParts[0]) {
            return true;
        }
        else if (existingVersion[0] == checkParts[0]) {
            if (existingVersion[1] >= checkParts[1]) {
                return true;
            }
        }
        return false;
    },
    createInstallPrompt: function(element, version, installPromptImage, useNewWindow) {
        if ((version != '1.0') && (version != '2.0')) {
            alert('The only supported Silverlight versions are 1.0 and 2.0');
            return null;
        }

        element.innerHTML = '<a class="silverlightInstallPrompt" title="Click to install Silverlight." href="http://go.microsoft.com/fwlink/?LinkID=' +
                            (version == '2.0' ? '108181' : '89241') +
                            (useNewWindow ? '" target="_new"' : '"') +
                            '><img border="0" src="' +
                            (installPromptImage || 'http://go.microsoft.com/fwlink/?LinkID=108181') +
                            '" /></a>';
    },
    createParams: function(source, parentElement, id, className) {
        return { source: source, parentElement: parentElement, id: id, className: className, version: '1.0' };
    },
    createInstance: function(params, loadCallback, context) {
        if (!this.isSupported) {
            return null;
        }

        var version = params.version;
        if ((version != '1.0') && (version != '2.0')) {
            alert('The only supported Silverlight versions are 1.0 and 2.0');
            return null;
        }

        var parentElement = params.parentElement;
        if (!this.isInstalled(version)) {
            if (params.alternateContent) {
                parentElement.innerHTML = params.alternateContent;
            }
            else if (!params.suppressInstallPrompt) {
                this.createInstallPrompt(parentElement, version, params.installPromptImage, params.installInNewWindow);
            }
            return null;
        }

        var count = _SL.count++;
        if (!params.source || params.xaml) {
            var xaml = params.xaml || '<Canvas xmlns="http://schemas.microsoft.com/client/2007" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"/>';
            var scriptElement = document.createElement('script');
            scriptElement.type = 'text/xaml';
            scriptElement.text = xaml;
            scriptElement.id = '__slXaml' + count;

            document.body.appendChild(scriptElement);
            params.source = '#__slXaml' + count;
            delete params.xaml;
        }
        if (params.startupArguments) {
            var initParams = [];
            for (var arg in params.startupArguments) {
                initParams.push(arg);
                initParams.push('=');
                initParams.push(params.startupArguments[arg]);
                initParams.push(',');
            }
            params.initParams = initParams.join('');
            delete params.startupArguments;
        }

        var id = params.id || '__sl' + count;
        var className = params.className || '';
        var style = params.style || '';

        if (loadCallback) {
            params.onLoad = '__slLoad' + count;
            window[params.onLoad] = _SL.createLoadHandler(loadCallback, parentElement, context);
        }
        if (params.progressCallback) {
            params.onSourceDownloadProgressChanged = '__slProgress' + count;
            window[params.onSourceDownloadProgressChanged] = _SL.createHandler(params.progressCallback);
            delete params.progressCallback;
        }
        params.onError = '__slError' +  count;
        if (params.errorCallback) {
            window[params.onError] = _SL.createHandler(params.errorCallback);
            delete params.errorCallback;
        }
        else {
            window[params.onError] = _SL.onError;
        }

        delete params.id;
        delete params.className;
        delete params.style;
        delete params.parentElement;
        delete params.version;
        delete params.installPromptImage;
        delete params.installUsesNewWindow;
        delete params.suppressInstallPrompt;
        delete params.alternateContent;

        var html = [
            '<object type="application/x-silverlight" data="data:application/x-silverlight," id="', id,
            '" class="', className,
            '" style="', style, '">'
        ];
        for (var name in params) {
            html.push('<param name="');
            html.push(name);
            html.push('" value="');
            html.push(params[name]);
            html.push('" />');
        }
        html.push('</object>');

        parentElement.innerHTML = html.join('');
        return parentElement.childNodes[0];
    }
};
var SilverlightPlugin = new _SL();
