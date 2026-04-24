#include <QQmlContext>
#include <QDomDocument>
#include <QDomElement>
#include <QDebug>

#include <settingsxmlhandler.h>

bool SettingsXmlHandler::readXmlFile(QIODevice &device, QSettings::SettingsMap &map){

    QDomDocument xmlDoc;
    xmlDoc.setContent(device.readAll());
    QDomElement conf = xmlDoc.documentElement().firstChildElement( "Configuration" );
    for(QDomElement n = conf.firstChildElement(); !n.isNull(); n = n.nextSiblingElement())
    {
        map.insert(n.tagName(), QVariant(n.attribute("value")));
    }
    return true;
}

bool SettingsXmlHandler::writeXmlFile(QIODevice &device, const QSettings::SettingsMap &map){

    QDomDocument xmlDoc;
    QDomProcessingInstruction xmlVers = xmlDoc.createProcessingInstruction("xml","version=\"1.0\" encoding='utf-8'");
    xmlDoc.appendChild(xmlVers);

    QDomElement root = xmlDoc.createElement( "PokerTH" );
    xmlDoc.appendChild( root );

    QDomElement config = xmlDoc.createElement( "Configuration" );
    root.appendChild( config );

    QMapIterator<QString, QVariant> i(map);
    while (i.hasNext()) {
        i.next();
        QDomElement tmpElement = xmlDoc.createElement(i.key());
        config.appendChild( tmpElement );
        tmpElement.setAttribute("value", i.value().toString());
    }
    device.write(xmlDoc.toString().toStdString().c_str());
    // @TODO: send a signal to configfile class?
    return true;
}
