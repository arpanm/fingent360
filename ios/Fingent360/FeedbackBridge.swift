import UIKit
import WebKit
import AVFoundation
import CryptoKit
import Security

private enum FeedbackFailure: Error { case invalid, unavailable, conflict, storage, denied }
private func feedbackOrigin(_ input: String) throws -> String {
    guard let url=URL(string:input), url.scheme=="https", let host=url.host, url.user==nil, url.password==nil, url.query==nil, url.fragment==nil, url.path.isEmpty || url.path=="/" else {throw FeedbackFailure.invalid}
    return "https://"+host+(url.port.map { $0==443 ? "" : ":\($0)" } ?? "")
}
/// Keychain key and protected ciphertext are never put in WebKit storage or app assets.
final class IOSFeedbackStore {
    private let origin: String
    private let file: URL
    init(origin: String) throws {
        self.origin=origin
        let root=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true).appendingPathComponent("Feedback",isDirectory:true)
        try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true,attributes:[.protectionKey:FileProtectionType.complete])
        var excluded=root;var values=URLResourceValues();values.isExcludedFromBackup=true;try excluded.setResourceValues(values)
        let digest=SHA256.hash(data:Data(origin.utf8)).map{String(format:"%02x",$0)}.joined()
        file=root.appendingPathComponent(digest+".sealed")
    }
    private func key() throws -> SymmetricKey {
        let query:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"com.fingent360.feedback-key-v1",kSecAttrAccount as String:"installation",kSecReturnData as String:true]
        var result:CFTypeRef?;let status=SecItemCopyMatching(query as CFDictionary,&result)
        if status==errSecSuccess,let bytes=result as? Data,bytes.count==32{return SymmetricKey(data:bytes)}
        guard status==errSecItemNotFound,!(try FileManager.default.contentsOfDirectory(at:file.deletingLastPathComponent(),includingPropertiesForKeys:nil)).contains(where:{$0.pathExtension=="sealed"}) else {throw FeedbackFailure.storage}
        var bytes=Data(count:32);let randomStatus=bytes.withUnsafeMutableBytes{SecRandomCopyBytes(kSecRandomDefault,32,$0.baseAddress!)};guard randomStatus==errSecSuccess else {throw FeedbackFailure.storage}
        let insert:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"com.fingent360.feedback-key-v1",kSecAttrAccount as String:"installation",kSecAttrAccessible as String:kSecAttrAccessibleWhenUnlockedThisDeviceOnly,kSecValueData as String:bytes]
        guard SecItemAdd(insert as CFDictionary,nil)==errSecSuccess else {throw FeedbackFailure.storage};return SymmetricKey(data:bytes)
    }
    private func checked(_ state:[String:Any]) throws -> [String:Any] {
        guard Set(state.keys)==Set(["records","config"]),let records=state["records"] as? [[String:Any]],records.count<=100,let config=state["config"] as? [String:Any],Set(config.keys)==Set(["enabled","apiOrigin"]),let active=config["enabled"] as? Bool,let destination=config["apiOrigin"] as? String else {throw FeedbackFailure.invalid}
        if active && destination.isEmpty {throw FeedbackFailure.invalid};if !destination.isEmpty && (try feedbackOrigin(destination)) != destination {throw FeedbackFailure.invalid}
        for record in records {guard record["submission"] is [String:Any],record["state"] is String else {throw FeedbackFailure.invalid}}
        guard try JSONSerialization.data(withJSONObject:state).count<=32*1024*1024 else {throw FeedbackFailure.storage};return state
    }
    func read() throws -> [String:Any] {
        guard FileManager.default.fileExists(atPath:file.path) else {return ["revision":0,"records":[],"config":["enabled":false,"apiOrigin":""]]}
        let attrs=try FileManager.default.attributesOfItem(atPath:file.path);guard ((attrs[.size] as? NSNumber)?.intValue ?? Int.max) <= 34*1024*1024 else {throw FeedbackFailure.storage}
        let clear=try AES.GCM.open(AES.GCM.SealedBox(combined:Data(contentsOf:file)),using:key(),authenticating:Data(origin.utf8))
        guard let root=try JSONSerialization.jsonObject(with:clear) as? [String:Any],Set(root.keys)==Set(["revision","records","config"]),let revision=root["revision"] as? NSNumber,revision.doubleValue>=0,revision.doubleValue<=9007199254740990,revision.doubleValue.rounded()==revision.doubleValue else {throw FeedbackFailure.storage}
        _=try checked(["records":root["records"]!,"config":root["config"]!]);return root
    }
    func write(expected:Double,state:[String:Any]) throws -> [String:Any] {
        guard expected>=0,expected<9007199254740990,expected.rounded()==expected else {throw FeedbackFailure.invalid}
        let current=try read();guard (current["revision"] as? NSNumber)?.doubleValue==expected else {throw FeedbackFailure.conflict}
        var root=try checked(state);root["revision"]=expected+1
        let sealed=try AES.GCM.seal(JSONSerialization.data(withJSONObject:root),using:key(),authenticating:Data(origin.utf8));guard let bytes=sealed.combined else {throw FeedbackFailure.storage}
        try bytes.write(to:file,options:[.atomic,.completeFileProtection]);return ["revision":expected+1]
    }
}
/// Ephemeral session: no cookies/cache, redirects refused, bounded streamed response.
private final class FeedbackTransfer:NSObject,URLSessionDataDelegate,URLSessionTaskDelegate {
    private var session:URLSession?;private var bytes=Data();private var status=0
    private var finish:((Result<[String:Any],Error>)->Void)?
    init(request:URLRequest,done:@escaping(Result<[String:Any],Error>)->Void){super.init();finish=done;let config=URLSessionConfiguration.ephemeral;config.httpShouldSetCookies=false;config.httpCookieStorage=nil;config.urlCache=nil;config.timeoutIntervalForRequest=30;config.timeoutIntervalForResource=30;session=URLSession(configuration:config,delegate:self,delegateQueue:nil);session?.dataTask(with:request).resume()}
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}
    func urlSession(_ session:URLSession,dataTask:URLSessionDataTask,didReceive response:URLResponse,completionHandler:@escaping(URLSession.ResponseDisposition)->Void){guard let response=response as? HTTPURLResponse,!(300..<400).contains(response.statusCode),response.expectedContentLength<=8500000 else {completionHandler(.cancel);return};status=response.statusCode;completionHandler(.allow)}
    func urlSession(_ session:URLSession,dataTask:URLSessionDataTask,didReceive data:Data){guard bytes.count+data.count<=8500000 else {dataTask.cancel();return};bytes.append(data)}
    func urlSession(_ session:URLSession,task:URLSessionTask,didCompleteWithError error:Error?){defer{finish=nil;session.finishTasksAndInvalidate();self.session=nil};guard error==nil,status>0 else {finish?(.failure(FeedbackFailure.unavailable));return};do{let body:Any=bytes.isEmpty ? NSNull() : try JSONSerialization.jsonObject(with:bytes);finish?(.success(["status":status,"body":body]))}catch{finish?(.failure(FeedbackFailure.unavailable))}}
    func cancel(){session?.invalidateAndCancel()}
}
final class IOSFeedbackBridge:NSObject,WKScriptMessageHandlerWithReply {
    weak var web:WKWebView?
    weak var presenter:UIViewController?
    private var exportController:UIActivityViewController?
    private var exportFolder:URL?
    private var exportCancel:(()->Void)?
    private let origin:String
    private let allowed:(URL)->Bool
    private let worker=DispatchQueue(label:"com.fingent360.feedback")
    private var store:IOSFeedbackStore?
    private var generation=0
    private var brokerPending:[String:(state:String,until:Date)]=[:]
    private var brokerReturns:[String:[String:String]]=[:]
    private var audioGeneration=0
    private var recorder:AVAudioRecorder?
    private var audioURL:URL?
    private var audioStarted:Date?
    private var transfer:FeedbackTransfer?
    init(origin:String,allowed:@escaping(URL)->Bool){self.origin=origin;self.allowed=allowed;super.init();NotificationCenter.default.addObserver(self,selector:#selector(interrupted),name:AVAudioSession.interruptionNotification,object:nil);if let abandoned=try? FileManager.default.contentsOfDirectory(at:FileManager.default.temporaryDirectory,includingPropertiesForKeys:nil){for folder in abandoned where folder.lastPathComponent.hasPrefix("f360-export-"){try? FileManager.default.removeItem(at:folder)}};if let files=try? FileManager.default.contentsOfDirectory(at:FileManager.default.temporaryDirectory,includingPropertiesForKeys:nil){for file in files where file.lastPathComponent.hasPrefix("feedback-voice-")&&file.pathExtension=="m4a"{try? FileManager.default.removeItem(at:file)}}}
    @objc private func interrupted(){DispatchQueue.main.async{[weak self] in self?.pause()}}
    deinit{if let folder=exportFolder{try? FileManager.default.removeItem(at:folder)};NotificationCenter.default.removeObserver(self);recorder?.stop();if let file=audioURL{try? FileManager.default.removeItem(at:file)};transfer?.cancel()}
    func invalidate(){exportCancel?();brokerPending.removeAll();brokerReturns.removeAll();generation+=1;cancelAudio();transfer?.cancel()}
    func pause(){cancelAudio();web?.evaluateJavaScript("window.dispatchEvent(new Event('f360-pause'))",completionHandler:nil)}
    func resume(){guard let url=web?.url,allowed(url)else{return};web?.evaluateJavaScript("window.dispatchEvent(new Event('f360-resume'))",completionHandler:nil)}
    // Credentials are consumed once in memory and never evaluated as JavaScript.
    func brokerReturn(_ url:URL)->Bool {
        guard URL(string:origin)?.scheme=="https",let current=web?.url,allowed(current),url.absoluteString.count<=5000,
              let parts=URLComponents(url:url,resolvingAgainstBaseURL:false),parts.scheme=="fingent360",parts.port==nil,parts.user==nil,parts.password==nil,parts.fragment==nil,parts.path.isEmpty,
              let host=parts.host,["broker-kite","broker-upstox","broker-angel"].contains(host) else{return false}
        let broker=String(host.dropFirst(7)),field=broker=="kite" ? "request_token" : broker=="upstox" ? "code" : "auth_token"
        guard let items=parts.queryItems,items.count==2,Set(items.map{$0.name})==Set(["state",field]),let state=items.first(where:{$0.name=="state"})?.value,let token=items.first(where:{$0.name==field})?.value,
              let pending=brokerPending[broker],pending.until>Date(),pending.state==state else{return false}
        let pattern=broker=="kite" ? "^[A-Za-z0-9_-]{8,256}$" : broker=="upstox" ? "^[A-Za-z0-9._~-]{1,512}$" : "^[A-Za-z0-9._~-]{8,4096}$"
        guard token.range(of:pattern,options:.regularExpression) != nil,brokerReturns[broker]==nil else{return false}
        let outputField=broker=="kite" ? "requestToken" : broker=="upstox" ? "code" : "authToken"
        brokerReturns[broker]=["state":state,outputField:token]
        // Constant signal; all credentials use WK structured replies.
        web?.evaluateJavaScript("window.dispatchEvent(new Event('f360-broker-ready'))",completionHandler:nil)
        return true
    }
    private func cancelAudio(){audioGeneration+=1;recorder?.stop();recorder=nil;if let file=audioURL{try? FileManager.default.removeItem(at:file)};audioURL=nil;audioStarted=nil;try? AVAudioSession.sharedInstance().setActive(false,options:.notifyOthersOnDeactivation)}
    private func stateStore() throws -> IOSFeedbackStore {if let store=store{return store};let created=try IOSFeedbackStore(origin:origin);store=created;return created}
    private func errorText(_ error:Error)->String {switch error{case FeedbackFailure.denied:return "Microphone permission was not granted. Enable it in iOS Settings or type feedback.";case FeedbackFailure.conflict:return "Feedback changed in another view. Reload and retry.";case FeedbackFailure.storage:return "Protected feedback storage is unavailable. Unlock the device or free storage, then retry. Existing records were not reset.";default:return "Native feedback could not complete. Reopen feedback history before retrying; existing records were preserved."}}
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage,replyHandler:@escaping(Any?,String?)->Void){
        guard Thread.isMainThread,let web=web,message.webView===web,message.frameInfo.isMainFrame,let frameURL=message.frameInfo.request.url,allowed(frameURL),let current=web.url,allowed(current),let expected=URL(string:origin),message.frameInfo.securityOrigin.protocol==expected.scheme,message.frameInfo.securityOrigin.host==expected.host,(message.frameInfo.securityOrigin.port==0 ? (expected.scheme=="https" ? 443 : 80) : message.frameInfo.securityOrigin.port)==(expected.port ?? (expected.scheme=="https" ? 443 : 80)),let args=message.body as? [String:Any],let action=args["action"] as? String else {replyHandler(nil,"Native feedback is unavailable from this page.");return}
        let requestGeneration=generation
        let deliver:(Any?,Error?)->Void={ [weak self] value,error in DispatchQueue.main.async {guard let self=self else {replyHandler(nil,"App view closed.");return};guard self.generation==requestGeneration,let url=self.web?.url,self.allowed(url) else {replyHandler(nil,"App page changed. Reopen feedback history.");return};replyHandler(value,error.map{ error in ["armBroker","takeBroker","clearBroker"].contains(action) ? "Broker return unavailable. Prepare a new connection in Holdings." : (action=="saveFile" ? "Export unavailable. Close another share sheet, check storage, and retry a supported file under 12 MB." : self.errorText(error))})}}
        let keys:[String:Set<String>]=["saveFile":["action","filename","mime","base64"],"armBroker":["action","broker","state","apiOrigin"],"takeBroker":["action","broker"],"clearBroker":["action","broker"],"captureFeedback":["action"],"feedbackRead":["action"],"feedbackWrite":["action","expectedRevision","state"],"sendFeedback":["action","apiOrigin","method","id","receiptToken","body"],"startFeedbackAudio":["action"],"stopFeedbackAudio":["action"],"cancelFeedbackAudio":["action"]]
        guard let required=keys[action],Set(args.keys)==required else {deliver(nil,FeedbackFailure.invalid);return}
        switch action {
        case "saveFile":
            var createdFolder:URL?
            do {
                guard exportController==nil,let presenter=presenter,presenter.presentedViewController==nil,
                      let name=args["filename"] as? String,name.range(of:"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$",options:.regularExpression) != nil,!name.contains(".."),
                      let mime=args["mime"] as? String,let encoded=args["base64"] as? String,encoded.count<=16000000,
                      let bytes=Data(base64Encoded:encoded),!bytes.isEmpty,bytes.count<=12000000 else{throw FeedbackFailure.invalid}
                let suffix=["application/json":"json","text/csv":"csv","video/webm":"webm","application/pdf":"pdf","text/plain":"txt","text/html":"html","image/png":"png","application/zip":"zip","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx"]
                let validSuffix=suffix[mime].map{name.lowercased().hasSuffix("."+$0)} ?? (mime=="application/octet-stream" && ["xlsx","bin","zip"].contains((name as NSString).pathExtension.lowercased()))
                guard validSuffix else{throw FeedbackFailure.invalid}
                let folder=FileManager.default.temporaryDirectory.appendingPathComponent("f360-export-"+UUID().uuidString,isDirectory:true)
                try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:false,attributes:[.protectionKey:FileProtectionType.complete]);exportFolder=folder;createdFolder=folder
                var excluded=folder;var flags=URLResourceValues();flags.isExcludedFromBackup=true;try excluded.setResourceValues(flags)
                let file=folder.appendingPathComponent(name);try bytes.write(to:file,options:[.atomic,.completeFileProtection])
                let sheet=UIActivityViewController(activityItems:[file],applicationActivities:nil)
                sheet.popoverPresentationController?.sourceView=web;sheet.popoverPresentationController?.sourceRect=CGRect(x:web.bounds.midX,y:web.bounds.midY,width:1,height:1)
                exportController=sheet
                var finished=false
                let finish:(Bool)->Void={ [weak self,weak sheet] completed in guard !finished else{return};finished=true;try? FileManager.default.removeItem(at:folder);self?.exportFolder=nil;self?.exportController=nil;self?.exportCancel=nil;sheet?.dismiss(animated:true);deliver(["completed":completed],nil)}
                exportCancel={finish(false)}
                sheet.completionWithItemsHandler={_,completed,_,error in DispatchQueue.main.async{finish(completed && error==nil)}}
                presenter.present(sheet,animated:true)
                DispatchQueue.main.asyncAfter(deadline:.now()+600){finish(false)}
            }catch{if let folder=createdFolder{try? FileManager.default.removeItem(at:folder);exportFolder=nil};deliver(nil,error)}

        case "armBroker","takeBroker","clearBroker":
            guard URL(string:origin)?.scheme=="https",let broker=args["broker"] as? String,["kite","upstox","angel"].contains(broker)else{deliver(nil,FeedbackFailure.invalid);return}
            if action=="armBroker"{guard args["apiOrigin"] as? String==origin,let state=args["state"] as? String,state.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil else{deliver(nil,FeedbackFailure.invalid);return};brokerPending[broker]=(state,Date().addingTimeInterval(600));brokerReturns[broker]=nil;DispatchQueue.main.asyncAfter(deadline:.now()+600){[weak self] in guard let self=self,self.brokerPending[broker]?.state==state else{return};self.brokerPending[broker]=nil;self.brokerReturns[broker]=nil};deliver(["armed":true],nil)}
            else if action=="clearBroker"{brokerPending[broker]=nil;brokerReturns[broker]=nil;deliver(["cleared":true],nil)}
            else{let pending=brokerPending[broker];let result=brokerReturns[broker];let valid=(pending?.until ?? .distantPast)>Date();if result != nil || !valid{brokerReturns[broker]=nil;brokerPending[broker]=nil};if valid,let result=result{deliver(result,nil)}else{deliver(NSNull(),nil)}}

        case "captureFeedback":
            let config=WKSnapshotConfiguration();config.rect=web.bounds;config.snapshotWidth=NSNumber(value:min(1200,Double(web.bounds.width)));web.takeSnapshot(with:config){image,error in guard error==nil,let image=image else {deliver(nil,FeedbackFailure.unavailable);return};let format=UIGraphicsImageRendererFormat();format.scale=1;var size=image.size;for _ in 0..<5{let rendered=UIGraphicsImageRenderer(size:size,format:format).image{_ in image.draw(in:CGRect(origin:.zero,size:size))};if let png=rendered.pngData(),png.count<=2000000{deliver("data:image/png;base64,"+png.base64EncodedString(),nil);return};size=CGSize(width:size.width*0.75,height:size.height*0.75)};deliver(nil,FeedbackFailure.unavailable)}
        case "startFeedbackAudio":
            guard recorder==nil else {deliver(nil,FeedbackFailure.invalid);return};audioGeneration+=1;let pending=audioGeneration
            AVAudioSession.sharedInstance().requestRecordPermission{ [weak self] granted in DispatchQueue.main.async {guard let self=self,self.audioGeneration==pending,self.generation==requestGeneration else {deliver(nil,FeedbackFailure.unavailable);return};guard granted else {deliver(nil,FeedbackFailure.denied);return};do{let session=AVAudioSession.sharedInstance();try session.setCategory(.record,mode:.default,options:[]);try session.setActive(true);let file=FileManager.default.temporaryDirectory.appendingPathComponent("feedback-voice-"+UUID().uuidString+".m4a");FileManager.default.createFile(atPath:file.path,contents:Data(),attributes:[.protectionKey:FileProtectionType.complete]);self.audioURL=file;let recording=try AVAudioRecorder(url:file,settings:[AVFormatIDKey:kAudioFormatMPEG4AAC,AVSampleRateKey:44100,AVNumberOfChannelsKey:1,AVEncoderBitRateKey:64000]);guard recording.record(forDuration:120)else{throw FeedbackFailure.unavailable};self.recorder=recording;self.audioStarted=Date();deliver(["recording":true],nil)}catch{self.cancelAudio();deliver(nil,error)}}}
        case "stopFeedbackAudio":
            do{guard let recording=recorder,let file=audioURL,let start=audioStarted else {throw FeedbackFailure.unavailable};let duration=min(120000,max(1,Int(Date().timeIntervalSince(start)*1000)));recording.stop();let bytes=try Data(contentsOf:file);guard !bytes.isEmpty,bytes.count<=4000000 else {throw FeedbackFailure.unavailable};let result:[String:Any]=["mime":"audio/mp4","base64":bytes.base64EncodedString(),"durationMs":duration];cancelAudio();deliver(result,nil)}catch{cancelAudio();deliver(nil,error)}
        case "cancelFeedbackAudio":cancelAudio();deliver(["cancelled":true],nil)
        default:
            worker.async{[weak self] in guard let self=self else {deliver(nil,FeedbackFailure.unavailable);return};do{let store=try self.stateStore();if action=="feedbackRead"{deliver(try store.read(),nil)}else if action=="feedbackWrite"{guard let expected=args["expectedRevision"] as? Double,let state=args["state"] as? [String:Any]else{throw FeedbackFailure.invalid};deliver(try store.write(expected:expected,state:state),nil)}else{let request=try self.request(args,store:store);DispatchQueue.main.async{guard self.generation==requestGeneration,self.transfer==nil else {deliver(nil,FeedbackFailure.unavailable);return};self.transfer=FeedbackTransfer(request:request){result in DispatchQueue.main.async{self.transfer=nil};switch result{case .success(let value):deliver(value,nil);case .failure(let error):deliver(nil,error)}}}}}catch{deliver(nil,error)}}
        }
    }
    private func request(_ args:[String:Any],store:IOSFeedbackStore)throws->URLRequest{guard let input=args["apiOrigin"] as? String,let method=args["method"] as? String,["POST","GET","DELETE"].contains(method) else {throw FeedbackFailure.invalid};let destination=try feedbackOrigin(input),state=try store.read();guard let config=state["config"] as? [String:Any],config["enabled"] as? Bool==true,config["apiOrigin"] as? String==destination else {throw FeedbackFailure.invalid};let id=args["id"] as? String,token=args["receiptToken"] as? String;if method=="POST"{guard args["id"] is NSNull,args["receiptToken"] is NSNull,args["body"] is [String:Any] else {throw FeedbackFailure.invalid}}else{guard let id=id,UUID(uuidString:id) != nil,let token=token,token.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil,args["body"] is NSNull else {throw FeedbackFailure.invalid}};guard let url=URL(string:destination+"/api/v1/feedback"+(id.map{"/"+$0} ?? ""))else{throw FeedbackFailure.invalid};var request=URLRequest(url:url);request.httpMethod=method;request.httpShouldHandleCookies=false;request.setValue("application/json",forHTTPHeaderField:"Accept");request.setValue("https://ios.fingent360.invalid",forHTTPHeaderField:"Origin");if let token=token{request.setValue(token,forHTTPHeaderField:"X-Feedback-Token")};if method=="POST"{let body=try JSONSerialization.data(withJSONObject:args["body"]!);guard body.count<=8500000 else {throw FeedbackFailure.invalid};request.httpBody=body;request.setValue("application/json",forHTTPHeaderField:"Content-Type")};return request}
}
