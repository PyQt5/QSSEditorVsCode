#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Created on 2022/05/19
@author: Irony
@site: https://pyqt.site https://github.com/PyQt5
@email: 892768447@qq.com
@file: generate_data.py
@description:
"""

import json
import os
import re
import sys
from collections import OrderedDict

import requests
from pyquery import PyQuery

g_syntax = {}


def dealwith_pre(html):
    for code in re.findall(r'(<pre.*?</pre>)', html, re.S):
        html = html.replace(
            code,
            str('```\n{}\n```'.format(
                PyQuery(code).text(squash_space=False).strip())))
    return html


def dealwith_a(html):
    for a in re.findall(r'(<a href="(.*?)">(.*?)</a>)', html, re.S):
        url = a[1].strip()
        html = html.replace(
            a[0], '[{}]({})'.format(
                a[2].strip(), url if url.startswith('http') else
                'https://doc.qt.io/qt-5/{}'.format(url)))
    return html


def generate_desc(html):
    """
    生成描述, 支持markdown

    @param html: 原始描述内容
    @return: 格式化后的描述
    """
    html = dealwith_pre(html)
    html = dealwith_a(html)
    return PyQuery(html).text(squash_space=False).strip()


def generate_types(doc):
    """
    生成属性类型节点
    """
    for tr in doc('.table:nth-child(20) tr[class!=qt-style]').items():
        tds = list(tr('td').items())
        g_syntax[tds[0].text()] = {
            'url':
                'https://doc.qt.io/qt-5/stylesheet-reference.html#{}'.format(
                    tds[0].text().lower().replace(' ', '-')),
            'syntax':
                PyQuery(tds[1].html()).text().strip(),
            'desc':
                generate_desc(tds[2].html())
        }


def generate_props(doc):
    """
    生成属性节点
    """
    properties = []
    for tr in doc('.table:nth-child(10) tr[class!=qt-style]').items():
        tds = list(tr('td').items())

        prop = OrderedDict()

        desc = OrderedDict()
        desc['kind'] = 'markdown'
        desc['value'] = generate_desc(tds[2].html())

        references = []
        syntax = tds[1].text().strip()
        if syntax in g_syntax:
            d = OrderedDict()
            d['name'] = syntax
            d['url'] = g_syntax[syntax]['url']
            references.append(d)

            desc['value'] = desc['value'] + '\n\n`{}`:\n{}'.format(
                syntax, generate_desc(g_syntax[syntax]['desc']))

        d = OrderedDict()
        d['name'] = 'list-of-properties'
        d['url'] = 'https://doc.qt.io/qt-5/stylesheet-reference.html#list-of-properties'
        references.append(d)

        prop['name'] = tds[0].text().replace('*',
                                             '').strip().strip('{').strip('}')
        prop['description'] = desc
        prop['references'] = references
        if syntax in g_syntax:
            prop['syntax'] = g_syntax[syntax]['syntax']

        properties.append(prop)
    return properties


def generate_pseudoClasses(doc):
    pseudoClasses = []
    for tr in doc('.table:nth-child(24) tr[class!=qt-style]').items():
        tds = list(tr('td').items())
        pseudo = OrderedDict()
        pseudo['name'] = tds[0].text()
        pseudo['description'] = generate_desc(tds[1].html())
        pseudoClasses.append(pseudo)
        # 为状态增加!
        pseudo = OrderedDict()
        pseudo['name'] = tds[0].text()
        pseudo['name'] = pseudo['name'][0:1] + '!' + pseudo['name'][1:]
        pseudo['description'] = generate_desc(tds[1].html())
        pseudoClasses.append(pseudo)
    return pseudoClasses


def generate_pseudoElements(doc):
    pseudoElements = []
    for tr in doc('.table:nth-child(29) tr[class!=qt-style]').items():
        tds = list(tr('td').items())
        pseudo = OrderedDict()
        pseudo['name'] = tds[0].text()
        pseudo['description'] = generate_desc(tds[1].html())
        pseudoElements.append(pseudo)
    return pseudoElements


def generate_qprops():
    """
    生成qproperty属性节点
    """
    properties = []
    names = [
        'QAbstractScrollArea', 'QAbstractSlider', 'QAbstractSpinBox',
        'QCalendarWidget', 'QCheckBox', 'QColorDialog', 'QColumnView',
        'QComboBox', 'QCommandLinkButton', 'QDateEdit', 'QDateTimeEdit',
        'QDial', 'QDialog', 'QDialogButtonBox', 'QDockWidget', 'QDoubleSpinBox',
        'QErrorMessage', 'QFileDialog', 'QFocusFrame', 'QFontComboBox',
        'QFontDialog', 'QFrame', 'QGraphicsView', 'QGroupBox', 'QHeaderView',
        'QInputDialog', 'QKeySequenceEdit', 'QLCDNumber', 'QLabel', 'QLineEdit',
        'QListView', 'QListWidget', 'QMainWindow', 'QMdiArea', 'QMdiSubWindow',
        'QMenu', 'QMenuBar', 'QMessageBox', 'QOpenGLWidget', 'QPlainTextEdit',
        'QProgressBar', 'QProgressDialog', 'QPushButton', 'QRadioButton',
        'QRubberBand', 'QScrollArea', 'QScrollBar', 'QSlider', 'QSpinBox',
        'QSplashScreen', 'QSplitter', 'QStackedWidget', 'QStatusBar', 'QTabBar',
        'QTabWidget', 'QTableView', 'QTableWidget', 'QTextBrowser', 'QTextEdit',
        'QTimeEdit', 'QToolBar', 'QToolBox', 'QToolButton', 'QTreeView',
        'QTreeWidget', 'QUndoView', 'QWidget', 'QWizard', 'QWizardPage'
    ]

    from PyQt5 import QtWidgets
    from PyQt5.QtCore import Qt

    app = QtWidgets.QApplication(sys.argv)
    pset = set()
    # ignores = {}
    widgets = {}

    for name in names:
        try:
            if name in widgets:
                w = widgets[name]
            else:
                if name == 'QHeaderView':
                    w = getattr(QtWidgets, name)(Qt.Horizontal)
                elif name == 'QRubberBand':
                    w = getattr(QtWidgets,
                                name)(QtWidgets.QRubberBand.Rectangle)
                else:
                    w = getattr(QtWidgets, name)()
                widgets[name] = w
            # print(w)
            metaObject = w.metaObject()
            for i in range(metaObject.propertyOffset(),
                           metaObject.propertyCount()):
                p = metaObject.property(i)

                if not hasattr(w, p.name()) or p.name(
                ) in pset or not p.isWritable() or not p.isDesignable():
                    print('ignore {} property: {}'.format(name, p.name()))
                    # if p.name() not in ignores:
                    #     ignores[p.name()] = []
                    # ignores[p.name()].append(name)
                    continue

                field = getattr(w, p.name())
                pset.add(p.name())
                prop = OrderedDict()
                prop['name'] = 'qproperty-' + p.name()

                desc = OrderedDict()
                desc['kind'] = 'markdown'
                desc['value'] = field.__doc__.strip()

                prop['description'] = desc
                properties.append(prop)
        except Exception as e:
            print(e)

    # print('pset:', pset)
    # print()
    # print('ignores:', ignores)

    for prop in properties:
        pname = prop['name'].replace('qproperty-', '')
        clazzs = []
        for name in names:
            try:
                w = widgets[name]
                # if hasattr(w, pname) and name not in ignores.get(pname, []):
                if hasattr(w, pname):
                    clazzs.append(name)
            except Exception as e:
                print(e)
        if clazzs:
            cclazzs = clazzs.copy()
            for c in cclazzs:
                if c not in widgets:
                    continue
                try:
                    widgets[c].__class__.__dict__[pname]
                except KeyError:
                    clazzs.remove(c)

            # 非直接的控件
            cclazzs = list(set(cclazzs) ^ set(clazzs))

            # 直接的控件属性引用
            references = []
            for c in clazzs:
                d = OrderedDict()
                d['name'] = c
                d['url'] = 'https://doc.qt.io/qt-5/{}.html#{}-prop'.format(
                    c.lower(), pname)
                references.append(d)
            if references:
                prop['references'] = references

            # 非直接的控件属性引用
            if cclazzs:
                prop['syntax'] = '\n| '.join(cclazzs)
    return properties


if __name__ == '__main__':
    print('generate qss.json started')
    if not os.path.exists('stylesheet-reference.html'):
        open('stylesheet-reference.html', 'wb').write(
            requests.get(
                'https://doc.qt.io/qt-5/stylesheet-reference.html').content)

    doc = PyQuery(open('stylesheet-reference.html', 'rb').read())
    data = OrderedDict()
    data['version'] = 1.1
    generate_types(doc)
    data['properties'] = generate_props(doc) + generate_qprops()
    data['pseudoClasses'] = generate_pseudoClasses(doc)
    data['pseudoElements'] = generate_pseudoElements(doc)
    with open(
            os.path.join(os.path.dirname(os.path.dirname(sys.argv[0])), 'data',
                         'qss.json'), 'wb') as fp:
        fp.write(json.dumps(data, indent=4).encode())
    print('generate qss.json finished')
