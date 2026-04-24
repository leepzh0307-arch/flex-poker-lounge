#pragma once

#include <QObject>
#include <QtCore>
#include <QSettings>

class SettingsXmlHandler : public QObject {
	public:
		static bool readXmlFile(QIODevice &device, QSettings::SettingsMap &map);
		static bool writeXmlFile(QIODevice &device, const QSettings::SettingsMap &map);
};