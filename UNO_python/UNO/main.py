"""
PROJET INFOMATIQUE-MATHS: UNO
"""

import random
import pygame
import os

# Initialise la bibliothèque Pygame
pygame.init()

# Définit la fenetre et couleurs
WIDTH, HEIGHT = 900, 500  # Taille de la fenêtre
WIN = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("UNO!")  # Nom de la fenêtre

BORDER = pygame.Rect(WIDTH // 2 - 5, 0, 10, HEIGHT)

FPS = 60  # Vitesse maximum à laquel la boucle main peut tourner

STARTING_HAND = 8
BOT_STARTING_HAND = 8
PILE_X, PILE_Y = 300, 150

# Importation images et sons
BACKGROUND = pygame.image.load(os.path.join(
    'Assets', 'background.png'))
LOGO = pygame.image.load(os.path.join(
    'Assets', 'logo.png'))
VICTOIRE = pygame.image.load(os.path.join(
    'Assets', 'victoire.png'))
DEFAITE = pygame.image.load(os.path.join(
    'Assets', 'defaite.png'))

PIOCHE_IMAGE = pygame.image.load(os.path.join(
    'Assets', 'deck.png'))
PIOCHE = pygame.transform.scale(PIOCHE_IMAGE, (150, 180))

CARD_BACK = pygame.image.load(os.path.join(
    'Assets', 'back.png'))

BLUE_BASE = pygame.image.load(os.path.join(
    'Assets', 'blue_base.png'))
RED_BASE = pygame.image.load(os.path.join(
    'Assets', 'red_base.png'))
GREEN_BASE = pygame.image.load(os.path.join(
    'Assets', 'green_base.png'))
YELLOW_BASE = pygame.image.load(os.path.join(
    'Assets', 'yellow_base.png'))

_0 = pygame.image.load(os.path.join(
    'Assets', '_0.png'))
_1 = pygame.image.load(os.path.join(
    'Assets', '_1.png'))
_2 = pygame.image.load(os.path.join(
    'Assets', '_2.png'))
_3 = pygame.image.load(os.path.join(
    'Assets', '_3.png'))
_4 = pygame.image.load(os.path.join(
    'Assets', '_4.png'))
_5 = pygame.image.load(os.path.join(
    'Assets', '_5.png'))
_6 = pygame.image.load(os.path.join(
    'Assets', '_6.png'))
_7 = pygame.image.load(os.path.join(
    'Assets', '_7.png'))
_8 = pygame.image.load(os.path.join(
    'Assets', '_8.png'))
_9 = pygame.image.load(os.path.join(
    'Assets', '_9.png'))
_draw2 = pygame.image.load(os.path.join(
    'Assets', '_draw2.png'))
_interdit = pygame.image.load(os.path.join(
    'Assets', '_interdit.png'))
_changement_couleur = pygame.image.load(os.path.join(
    'Assets', '_wild.png'))
_draw4 = pygame.image.load(os.path.join(
    'Assets', '_wild_draw.png'))


def dessine_fenetre(mj, mb, p):
    """
    Cette fonction définie tout ce qui est dessiné dans la fenêtre
    """
    WIN.blit(BACKGROUND, (0, 0))
    WIN.blit(PIOCHE, (700, 150))
    afficher_pile(p)
    afficher_main(mj, mb)

    if mj == []:
        WIN.blit(VICTOIRE, (200, 100))
    if mb == []:
        WIN.blit(DEFAITE, (200, 100))
    # Met à jour la fenêtre
    pygame.display.update()


def main():
    """
    Cette fonction définie la boucle de jeu et permet de mettre à jour les evenements
    """
    clock = pygame.time.Clock()
    run = True
    pile_carte: list = []
    hand: list = []
    bot_hand: list = []
    for i in range(STARTING_HAND):
        hand.append(Carte())
    for j in range(BOT_STARTING_HAND):
        bot_hand.append(Carte())

    while run:
        clock.tick(FPS)
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                # Arrête la boucle de jeu et donc quitte le programme
                run = False
            if event.type == pygame.MOUSEBUTTONDOWN:
                carte_selectionne = -1
                for i in hand:
                    if i.selection():
                        carte_selectionne = i

                if carte_selectionne != -1:
                    bot_passe = False
                    if carte_selectionne.jouable(pile_carte, True):
                        pile_carte.append(carte_selectionne)
                        if effet_carte(carte_selectionne) == 1:
                            for i in range(2):
                                bot_hand.append(Carte())
                        elif effet_carte(carte_selectionne) == 2:
                            bot_passe = True
                        elif effet_carte(carte_selectionne) == 4:
                            for i in range(4):
                                bot_hand.append(Carte())

                        trouvee = False
                        for i in hand:
                            if i == carte_selectionne and not trouvee:
                                hand.remove(i)
                                trouvee = True

                        dessine_fenetre(hand, bot_hand, pile_carte)
                        pygame.time.wait(1000)

                        if bot_passe:
                            bot_passe = False
                        else:
                            if tour_bot(bot_hand, pile_carte) and hand != []:
                                carte = tour_bot(bot_hand, pile_carte)
                                pile_carte.append(carte)
                                carte.jouable(pile_carte, True)
                                if effet_carte(carte) == 1:
                                    for i in range(2):
                                        hand.append(Carte())
                                elif effet_carte(carte) == 2:
                                    pass
                                elif effet_carte(carte) == 4:
                                    for i in range(4):
                                        hand.append(Carte())

                                trouvee = False
                                for i in bot_hand:
                                    if i == carte and not trouvee:
                                        bot_hand.remove(i)
                                        trouvee = True
                            else:
                                bot_hand.append(Carte())

                if 700 < pygame.mouse.get_pos()[0] < 850 and 140 < pygame.mouse.get_pos()[1] < 345:
                    hand.append(Carte())

        dessine_fenetre(hand, bot_hand, pile_carte)


    pygame.quit()


class Carte(object):
    """ Classe défissant une carte de jeu caratérisée par:
        -sa valeur
        -sa couleur
    """

    def __init__(self):  # notre constructeur
        """Constructeur de la classe Carte,
        - les attributs privés sont précédés de 2 underscores
        valeur et couleur sont privés
        """

        self.__valeur = random.randint(0, 13)
        self.__couleur = random.randint(0, 3)
        self.__jouee = False
        self.__position = (0, 0)
        self.__rotation = random.randint(0, 360)

    def getValeur(self):
        '''Retourne la valeur d'une carte'''
        return self.__valeur

    def getCouleur(self):
        """Retourne la couleur d'une carte"""
        if self.__valeur == 12 or self.__valeur == 13:
            return 'noir'
        elif self.__couleur == 0:
            return 'bleu'
        elif self.__couleur == 1:
            return 'rouge'
        elif self.__couleur == 2:
            return 'vert'
        elif self.__couleur == 3:
            return 'jaune'

    def __str__(self):
        return str((self.getValeur(), self.getCouleur()))

    def selection(self):
        if self.__position < pygame.mouse.get_pos() < (self.__position[0] + 130, self.__position[1] + 100):
            return True

    def jouable(self, pile_cartes, update):
        """
        Retourne True si la carte donnée en paramètre est jouable
        """
        if self.__jouee:
            return False
        if not pile_cartes:
            return True
        derniere_carte = pile_cartes[len(pile_cartes) - 1]


        if self.getValeur() == derniere_carte.getValeur() :
            if update:
                self.__jouee = True
            return True
        elif self.getCouleur() == derniere_carte.getCouleur():
            if update:
                self.__jouee = True
            return True
        elif derniere_carte.getCouleur() == 'noir':
            if update:
                self.__jouee = True
            return True
        elif self.getCouleur() == 'noir':
            if update:
                self.__jouee = True
            return True
        else:
            return False

    def afficherCarte(self, x, y, visible):
        self.__position = (x, y)
        temp_img = CARD_BACK

        if self.getCouleur() == 'bleu':
            temp_img = BLUE_BASE
        elif self.getCouleur() == 'rouge':
            temp_img = RED_BASE
        elif self.getCouleur() == 'vert':
            temp_img = GREEN_BASE
        elif self.getCouleur() == 'jaune':
            temp_img = YELLOW_BASE

        if visible:
            img = temp_img
        else:
            img = CARD_BACK
        if self.__jouee:
            img = pygame.transform.rotate(temp_img, self.__rotation)
            if x == PILE_X and y == PILE_Y:
                WIN.blit(img, (x, y))
        else:
            WIN.blit(img, (x, y))

        if self.getValeur() == 0:
            temp_img = _0
        elif self.getValeur() == 1:
            temp_img = _1
        elif self.getValeur() == 2:
            temp_img = _2
        elif self.getValeur() == 3:
            temp_img = _3
        elif self.getValeur() == 4:
            temp_img = _4
        elif self.getValeur() == 5:
            temp_img = _5
        elif self.getValeur() == 6:
            temp_img = _6
        elif self.getValeur() == 7:
            temp_img = _7
        elif self.getValeur() == 8:
            temp_img = _8
        elif self.getValeur() == 9:
            temp_img = _9
        elif self.getValeur() == 10:
            temp_img = _draw2
        elif self.getValeur() == 11:
            temp_img = _interdit
        elif self.getValeur() == 12:
            temp_img = _changement_couleur
        elif self.getValeur() == 13:
            temp_img = _draw4

        if visible:
            img = temp_img
        else:
            img = CARD_BACK
        if self.__jouee:
            img = pygame.transform.rotate(temp_img, self.__rotation)
            if x == PILE_X and y == PILE_Y:
                WIN.blit(img, (x, y))
        else:
            WIN.blit(img, (x, y))


def tour_bot(hand, pile_carte):
    carte = None
    for j in hand:
        if j.jouable(pile_carte, False):
            carte = j

    if carte is None:
        return False
    else:
        return carte


def effet_carte(carte):
    if carte == True or carte == False:
        return

    if carte.getValeur() == 10:
        return 1
    if carte.getValeur() == 11:
        return 2
    if carte.getValeur() == 12:
        return 3
    if carte.getValeur() == 13:
        return 4


def afficher_main(mj, mb):
    """
    Hyp: mj est la liste d'objets Carte du joueur et mb celle du bot
    """
    position = WIDTH / 10
    for i in mj:
        i.afficherCarte(position, HEIGHT - 120, True)
        position += 65

    position = WIDTH / 10
    for j in mb:
        j.afficherCarte(position, -105, False)
        position += 65


def afficher_pile(pile_carte):
    """
    Hyp: pile_carte est une liste d'objet Carte
    """
    if pile_carte == []:
        return
    for i in pile_carte:
        i.afficherCarte(PILE_X, PILE_Y, True)


if __name__ == "__main__":
    main()
