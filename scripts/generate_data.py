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

from collections import OrderedDict
import re
import json
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

        prop['name'] = tds[0].text().replace('*', '').strip()
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


if __name__ == '__main__':
    print('generate qss.json started')
    doc = PyQuery(
        requests.get(
            'https://doc.qt.io/qt-5/stylesheet-reference.html').content)
    data = OrderedDict()
    data['version'] = 1.1
    generate_types(doc)
    data['properties'] = generate_props(doc)
    data['pseudoClasses'] = generate_pseudoClasses(doc)
    data['pseudoElements'] = generate_pseudoElements(doc)
    with open('../data/qss.json', 'wb') as fp:
        fp.write(json.dumps(data, indent=4).encode())
    print('generate qss.json finished')
